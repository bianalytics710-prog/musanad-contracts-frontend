/**
 * 2026-06-14 — Contract Detail "Notices" tab + Draft / Confirm-Send dialogs.
 *
 * End-to-end flow for Legal Counsel's risk-case → contract → notice workflow:
 *
 *   1. Layla opens a risk case, clicks contract → lands here.
 *   2. Tab lists preserved notices for the contract (any status, incl. sent).
 *   3. "Draft notice" button opens GenerateNoticeDialog:
 *        - Template picker (one per draft_type catalog)
 *        - Mustache preview pane (rendered server-side at generate time)
 *        - Two CTAs: Send directly  |  Send for executive review
 *   4. Send directly path → ConfirmSendDialog (shows resolved recipient
 *      + email + source) → final Send button calls fn_advisory_draft_send_directly.
 *   5. Executive review path → fn_advisory_draft_route_for_review → toast
 *      "Routed to Eman" + draft appears in Eman's My Work (advisory_draft
 *      branch surfaces it via metadata.currentReviewer='executive').
 *   6. After Eman approves, the draft comes back to Layla as 'approved'
 *      + currentReviewer='legal_counsel'. From the Notices tab she clicks
 *      "Send now" → ConfirmSendDialog → fn_advisory_draft_send_after_review.
 *   7. Once sent, the row shows status='Sent' + dispatch count + "Resend".
 *
 * Three-states for fetch handled (loading/empty/error). i18n via t() with
 * defaultValue fallbacks; AR parity handled by the existing locale sweep.
 */
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileEdit, Send, Eye, Clock, CheckCircle2, RefreshCw, AlertTriangle, ChevronRight, X, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  advisoryDraftsService,
  type ContractAdvisorySummary,
} from '@/services/api/advisory-drafts.service';
import { formatDateTime } from '@/utils/datetime';
import { useAuthStore, selectUser } from '@/store/auth.store';
import { GenerateNoticeDialog } from './GenerateNoticeDialog';
import { ConfirmSendDialog } from './ConfirmSendDialog';

// ─── Template catalog (matches advisory_template seed) ───────────────────
// Hardcoded so the picker is instant; mirrors the DB rows. Keys map to
// advisory_template.id; UI strings use defaultValue + i18n.
// Template catalog + preselect helpers moved into GenerateNoticeDialog.tsx.

// Default Mustache context filled with sensible demo values. The user
// could refine this in a future iteration; for now we ship defaults that
// (defaultContext moved into GenerateNoticeDialog.tsx — keep this file lean.)

interface ContractNoticesTabProps {
  contractId: number;
  contractNumber: string;
  counterpartyName: string | null;
  // When entering from /app/risk-cases/$id, this is carried in ?riskCase=N.
  // Used to (a) preselect template, (b) link the draft back to the case.
  riskCaseIdFromUrl?: string;
  // Risk type derived from the risk case (optional); preselects template.
  riskTypeFromUrl?: string | null;
}

export function ContractNoticesTab({
  contractId,
  contractNumber,
  counterpartyName,
  riskCaseIdFromUrl,
  riskTypeFromUrl,
}: ContractNoticesTabProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore(selectUser);
  const isExecutive = user?.role?.name === 'executive';
  const [showGenerate, setShowGenerate] = useState(false);
  const [confirmSendDraft, setConfirmSendDraft] = useState<ContractAdvisorySummary | null>(null);
  const [confirmResendDraft, setConfirmResendDraft] = useState<ContractAdvisorySummary | null>(null);
  const [previewDraft, setPreviewDraft] = useState<ContractAdvisorySummary | null>(null);

  // 2026-06-14 — Executive approve action. Flips currentReviewer back to
  // legal_counsel + status to 'approved'; LC then sees the "Send now" row.
  const approveMutation = useMutation({
    mutationFn: (id: number) => advisoryDraftsService.execApprove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contractAdvisories', contractId] });
      toast.success(
        t('contracts.notices.approvedToast', {
          defaultValue: 'Approved — sent back to legal counsel for dispatch.',
        }),
      );
    },
    onError: (e) => toast.error(
      t('contracts.notices.approveError', {
        defaultValue: "Couldn't approve: {{msg}}",
        msg: (e as Error).message,
      }),
    ),
  });

  const noticesQuery = useQuery({
    queryKey: ['contractAdvisories', contractId],
    queryFn: () => advisoryDraftsService.listByContract(contractId),
    staleTime: 15_000,
  });

  const handleDraftClick = () => setShowGenerate(true);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['contractAdvisories', contractId] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">
            {t('contracts.notices.title', { defaultValue: 'Notices' })}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {t('contracts.notices.subtitle', {
              defaultValue:
                'Cure notices, force majeure invocations, sanctions holds and other advisories drafted for this contract. Every notice is preserved.',
            })}
          </p>
        </div>
        <Button type="button" size="sm" onClick={handleDraftClick} data-testid="notices-draft-open">
          <FileEdit className="h-3.5 w-3.5" />
          {t('contracts.notices.draftNotice', { defaultValue: 'Draft notice' })}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {noticesQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : noticesQuery.isError ? (
            <div className="p-6 text-sm text-[var(--terracotta)] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {t('contracts.notices.loadError', { defaultValue: "Couldn't load notices." })}
            </div>
          ) : (noticesQuery.data?.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-sm text-ink-muted">
              {t('contracts.notices.empty', {
                defaultValue: 'No notices drafted yet. Click "Draft notice" to start one.',
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('contracts.notices.cols.type', { defaultValue: 'Notice' })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('contracts.notices.cols.status', { defaultValue: 'Status' })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('contracts.notices.cols.recipient', { defaultValue: 'Recipient' })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('contracts.notices.cols.created', { defaultValue: 'Created' })}
                    </th>
                    <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle text-center">
                      {t('contracts.notices.cols.action', { defaultValue: 'Action' })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {noticesQuery.data!.map((n) => (
                    <NoticeRow
                      key={n.id}
                      notice={n}
                      isExecutive={isExecutive}
                      onView={() => setPreviewDraft(n)}
                      onSend={() => setConfirmSendDraft(n)}
                      onResend={() => setConfirmResendDraft(n)}
                      onApprove={() => approveMutation.mutate(n.id)}
                      approvePending={approveMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showGenerate && (
        <GenerateNoticeDialog
          open={showGenerate}
          onOpenChange={setShowGenerate}
          contractId={contractId}
          contractNumber={contractNumber}
          counterpartyName={counterpartyName}
          riskCaseId={riskCaseIdFromUrl ? Number(riskCaseIdFromUrl) : null}
          riskType={riskTypeFromUrl}
          onPickSendDirectly={(draft) => {
            invalidate();
            setConfirmSendDraft({
              id: draft.id,
              draftType: draft.draftType,
              approvalStatus: 'unapproved',
              templateId: '', templateDisplayEn: '', templateDisplayAr: null,
              reviewPath: null, currentReviewer: 'legal_counsel',
              linkedRiskCaseId: draft.linkedRiskCaseId ? String(draft.linkedRiskCaseId) : null,
              createdAt: new Date().toISOString(),
              createdBy: null, createdByName: null,
              approvedAt: null, approvedBy: null, approvedByName: null,
              dispatchedAt: null, dispatchChannel: null,
              dispatchRecipients: [], dispatchCount: 0, lastDispatchAt: null,
              generatedTextEn: '', generatedTextAr: null,
              finalTextEn: null, finalTextAr: null,
            });
          }}
          onPickSendAfterReview={(draft) => {
            // 2026-06-15 — exec-approved draft, LC dispatching. Mode flips
            // to send_after_review (status='approved' check on the BE).
            invalidate();
            setConfirmSendDraft({
              id: draft.id,
              draftType: draft.draftType,
              approvalStatus: 'approved',
              templateId: '', templateDisplayEn: '', templateDisplayAr: null,
              reviewPath: 'executive_review', currentReviewer: 'legal_counsel',
              linkedRiskCaseId: draft.linkedRiskCaseId ? String(draft.linkedRiskCaseId) : null,
              createdAt: new Date().toISOString(),
              createdBy: null, createdByName: null,
              approvedAt: new Date().toISOString(), approvedBy: null, approvedByName: null,
              dispatchedAt: null, dispatchChannel: null,
              dispatchRecipients: [], dispatchCount: 0, lastDispatchAt: null,
              generatedTextEn: '', generatedTextAr: null,
              finalTextEn: null, finalTextAr: null,
            });
          }}
          onRoutedForReview={() => {
            invalidate();
            toast.success(
              t('contracts.notices.routedToast', {
                defaultValue: 'Routed to executive for review.',
              }),
            );
          }}
        />
      )}

      {confirmSendDraft && (
        <ConfirmSendDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmSendDraft(null); }}
          contractId={contractId}
          draftId={confirmSendDraft.id}
          mode={confirmSendDraft.approvalStatus === 'approved' ? 'send_after_review' : 'send_directly'}
          onSent={() => {
            invalidate();
            setConfirmSendDraft(null);
            toast.success(
              t('contracts.notices.sentToast', { defaultValue: 'Notice sent.' }),
            );
          }}
        />
      )}

      {confirmResendDraft && (
        <ConfirmSendDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmResendDraft(null); }}
          contractId={contractId}
          draftId={confirmResendDraft.id}
          mode="resend"
          onSent={() => {
            invalidate();
            setConfirmResendDraft(null);
            toast.success(
              t('contracts.notices.resentToast', { defaultValue: 'Notice resent.' }),
            );
          }}
        />
      )}

      {previewDraft && (
        <PreviewDialog
          open
          onOpenChange={(o) => { if (!o) setPreviewDraft(null); }}
          notice={previewDraft}
        />
      )}
    </div>
  );
}

// ─── Per-row component ────────────────────────────────────────────────────
function NoticeRow({
  notice,
  isExecutive,
  onView,
  onSend,
  onResend,
  onApprove,
  approvePending,
}: {
  notice: ContractAdvisorySummary;
  isExecutive: boolean;
  onView: () => void;
  onSend: () => void;
  onResend: () => void;
  onApprove: () => void;
  approvePending: boolean;
}) {
  const { t } = useTranslation();
  const status = derivedStatus(notice);
  // Executive sees "Approve" on rows awaiting their review.
  const canApprove = isExecutive
    && notice.currentReviewer === 'executive'
    && notice.approvalStatus === 'unapproved';
  const recipient = notice.dispatchRecipients?.[0];
  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-surface/50">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-ink">
          {notice.templateDisplayEn || notice.draftType}
        </div>
        {notice.linkedRiskCaseId && (
          <div className="text-[11px] text-ink-muted">
            {t('contracts.notices.fromCase', {
              defaultValue: 'From risk case #{{id}}',
              id: notice.linkedRiskCaseId,
            })}
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.tone}`}>
          {status.icon}
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-xs text-ink-muted">
        {recipient ? (
          <span>
            <span className="block text-ink">{recipient.name ?? '—'}</span>
            <span className="font-mono">{recipient.address}</span>
          </span>
        ) : (
          <span className="text-ink-muted/60">—</span>
        )}
        {notice.dispatchCount > 1 && (
          <div className="mt-0.5 text-[10px] text-ink-muted">
            {t('contracts.notices.sentNTimes', {
              defaultValue: 'Sent {{n}} times',
              n: notice.dispatchCount,
            })}
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top text-xs text-ink-muted whitespace-nowrap font-mono">
        {formatDateTime(notice.createdAt, { showTime: false })}
      </td>
      <td className="px-4 py-3 align-top text-center">
        <div className="flex items-center justify-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
            {t('common.view', { defaultValue: 'View' })}
          </Button>
          {status.canSend && (
            <Button type="button" size="sm" onClick={onSend}>
              <Send className="h-3.5 w-3.5" />
              {t('contracts.notices.sendNow', { defaultValue: 'Send now' })}
            </Button>
          )}
          {status.canResend && (
            <Button type="button" size="sm" variant="outline" onClick={onResend}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t('contracts.notices.resend', { defaultValue: 'Resend' })}
            </Button>
          )}
          {canApprove && (
            <Button type="button" size="sm" onClick={onApprove} disabled={approvePending}>
              <ThumbsUp className="h-3.5 w-3.5" />
              {t('contracts.notices.approve', { defaultValue: 'Approve' })}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function derivedStatus(n: ContractAdvisorySummary): {
  label: string;
  tone: string;
  icon: ReactElement;
  canSend: boolean;
  canResend: boolean;
} {
  if (n.dispatchedAt) {
    return {
      label: 'Sent',
      tone: 'bg-sage-tint text-sage-ink',
      icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
      canSend: false,
      canResend: true,
    };
  }
  if (n.approvalStatus === 'approved' && n.currentReviewer === 'legal_counsel') {
    return {
      label: 'Approved — ready to send',
      tone: 'bg-blue-500/10 text-blue-700',
      icon: <ChevronRight className="h-3 w-3" aria-hidden="true" />,
      canSend: true,
      canResend: false,
    };
  }
  if (n.currentReviewer === 'executive') {
    return {
      label: 'Awaiting executive review',
      tone: 'bg-gold/15 text-foreground',
      icon: <Clock className="h-3 w-3" aria-hidden="true" />,
      canSend: false,
      canResend: false,
    };
  }
  if (n.approvalStatus === 'rejected') {
    return {
      label: 'Rejected',
      tone: 'bg-[var(--terracotta)]/10 text-[var(--terracotta)]',
      icon: <X className="h-3 w-3" aria-hidden="true" />,
      canSend: false,
      canResend: false,
    };
  }
  return {
    label: 'Draft',
    tone: 'bg-muted text-muted-foreground',
    icon: <FileEdit className="h-3 w-3" aria-hidden="true" />,
    canSend: false,
    canResend: false,
  };
}

// ─── (Inline Generate + ConfirmSend dialogs moved to dedicated files) ───
// See GenerateNoticeDialog.tsx + ConfirmSendDialog.tsx. PreviewDialog
// below stays inline — it's only used by the View action on this tab.

// ─── Preview dialog ──────────────────────────────────────────────────────
function PreviewDialog({
  open,
  onOpenChange,
  notice,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  notice: ContractAdvisorySummary;
}) {
  const { t } = useTranslation();
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const bodyEn = notice.finalTextEn ?? notice.generatedTextEn;
  const bodyAr = notice.finalTextAr ?? notice.generatedTextAr;
  const body = lang === 'en' ? bodyEn : bodyAr;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {notice.templateDisplayEn || notice.draftType}
          </DialogTitle>
          <DialogDescription>
            {t('contracts.notices.preview.description', {
              defaultValue: 'Rendered notice text. Use this to verify content before sending.',
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-1 pb-2">
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`rounded px-2 py-0.5 text-[10px] ${lang === 'en' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
          >EN</button>
          <button
            type="button"
            onClick={() => setLang('ar')}
            className={`rounded px-2 py-0.5 text-[10px] ${lang === 'ar' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
            disabled={!bodyAr}
          >AR</button>
        </div>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface/40 p-4 text-xs text-ink">
          {body || t('common.empty', { defaultValue: '(empty)' })}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
