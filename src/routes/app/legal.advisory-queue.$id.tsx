/**
 * /app/legal/advisory-queue/$id — Single advisory draft detail page.
 *
 * M16 / CR-H — gated by advisory.draft.review
 * T1 service, T2 React Query, T3 i18n, T4 three data states, T5 tokens,
 * T6 a11y, T7 type-safe, T9 destructive confirmation for Dispatch,
 * T11 ErrorBoundary, T12 formatDateTime.
 * A7: apiClient only in service.
 * C14: Router Link for back nav.
 * Self-approval guard: Approve button hidden when currentUser.id === draft.createdBy.
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CheckCircle2, Send, Trash2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { advisoryDraftsService } from '@/services/api/advisory-drafts.service';
import { AdvisoryDraftPreview } from '@/components/advisory/AdvisoryDraftPreview';
import { AdvisoryModifyDialog } from '@/components/advisory/AdvisoryModifyDialog';
import { AdvisoryRejectDialog } from '@/components/advisory/AdvisoryRejectDialog';
import { translateApiError } from '@/lib/translate-api-error';

export const Route = createFileRoute('/app/legal/advisory-queue/$id')({
  component: () => (
    <ErrorBoundary>
      <LegalAdvisoryDraftDetailView />
    </ErrorBoundary>
  ),
});

function LegalAdvisoryDraftDetailView() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const canReview = useAuthStore(selectHasPermission('advisory.draft.review'));
  const canDispatch = useAuthStore(selectHasPermission('advisory.dispatch'));
  const currentUserId = useAuthStore((s) => s.user?.id);

  const qc = useQueryClient();

  const [showModify, setShowModify] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');

  const { data: draft, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['advisoryDrafts', Number(id)],
    queryFn: () => advisoryDraftsService.getById(Number(id)),
    enabled: canReview && !!id && !isNaN(Number(id)),
    staleTime: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: () => advisoryDraftsService.approve(Number(id)),
    onSuccess: () => {
      toast.success(t('legal.advisoryQueue.toast.approved'));
      void qc.invalidateQueries({ queryKey: ['advisoryDrafts'] });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'legal.advisoryQueue.errors.approveFailed'));
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: () =>
      advisoryDraftsService.dispatch(Number(id), {
        recipients: [{ email: recipientEmail, name: recipientName }],
      }),
    onSuccess: () => {
      // Single visible alert per the design feedback — just the toast with
      // the recipient's name so the user knows what was sent and to whom.
      toast.success(
        t('legal.advisoryQueue.toast.dispatchedToRecipient', {
          recipient: recipientName,
          defaultValue: `Email sent to ${recipientName}`,
        }),
      );
      void qc.invalidateQueries({ queryKey: ['advisoryDrafts'] });
      setShowDispatchConfirm(false);
      setRecipientEmail('');
      setRecipientName('');
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'legal.advisoryQueue.errors.dispatchFailed'));
    },
  });

  /** Opens the Dispatch dialog with the recipient fields pre-filled from the
   *  draft's counterparty. Falls back to a synthetic demo address when the
   *  party has no contact_email so the user can still send a test message. */
  const handleOpenDispatchDialog = () => {
    const name = draft?.counterpartyName ?? '';
    const explicitEmail = draft?.counterpartyEmail ?? null;
    const slug = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24) || 'counterparty';
    const fallbackEmail = `contracts@${slug}.example.com`;
    setRecipientName(String(name));
    setRecipientEmail(explicitEmail ?? fallbackEmail);
    setShowDispatchConfirm(true);
  };

  if (!canReview) {
    return (
      <div className="mx-auto w-full max-w-[1200px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  // Self-approval guard — Approve hidden if this user created the draft
  const isSelfApproval = draft && currentUserId !== undefined && draft.createdBy === currentUserId;
  const canApprove = canReview && !isSelfApproval && draft?.approvalStatus === 'unapproved';
  const canDoModify = canReview && (draft?.approvalStatus === 'unapproved' || draft?.approvalStatus === 'modified');
  const canDoDispatch = canDispatch && draft?.approvalStatus === 'approved' && !draft?.dispatchedAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-6 p-6"
    >
      {/* Back */}
      <div className="flex items-center gap-2">
        <Link
          to="/app/legal/advisory-queue"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('legal.advisoryQueue.backToList')}
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          <p className="text-sm text-error">
            {(error as Error)?.message ?? t('common.error')}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {draft && (
        <>
          {/* Title + action bar */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1">
              {/* L30 — narrative H1: template name + counterparty (falls back to id). */}
              <h1 className="text-2xl font-semibold text-ink">
                {draft.templateMeta?.displayNameEn ?? t('legal.advisoryQueue.detailTitle', { id: draft.id })}
              </h1>
              {(draft as { contractNumber?: string | null }).contractNumber && (
                <p className="mt-1 font-mono text-xs text-ink-muted">
                  {(draft as { contractNumber: string }).contractNumber}
                </p>
              )}
              {isSelfApproval && (
                <p className="mt-1 flex items-center gap-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  {t('legal.advisoryQueue.selfApprovalNotice')}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Edit/Modify */}
              {canDoModify && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModify(true)}
                >
                  {t('legal.advisoryQueue.actions.modify')}
                </Button>
              )}

              {/* Reject */}
              {canReview && draft.approvalStatus === 'unapproved' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReject(true)}
                  className="border-error/30 text-error hover:bg-error/5"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {t('legal.advisoryQueue.actions.reject')}
                </Button>
              )}

              {/* Approve — hidden on self-approval */}
              {canApprove && (
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {approveMutation.isPending
                    ? t('common.saving')
                    : t('legal.advisoryQueue.actions.approve')}
                </Button>
              )}

              {/* Dispatch — only after approved. Opens a pre-filled popup. */}
              {canDoDispatch && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenDispatchDialog}
                >
                  <Send className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {t('legal.advisoryQueue.actions.dispatch')}
                </Button>
              )}
            </div>
          </div>

          {/* Sectioned draft — the preview now carries Why / What / Clauses /
              Risk / Next steps / Trail in one structured surface. No more
              sidebar duplication. */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <AdvisoryDraftPreview draft={draft} />
          </div>

          {/* Dispatch popup — shadcn Dialog with semantic design-system tokens.
              Recipient is auto-filled from the draft's counterparty so the
              user typically just clicks Send. */}
          <Dialog
            open={showDispatchConfirm}
            onOpenChange={(open) => {
              if (!open && !dispatchMutation.isPending) setShowDispatchConfirm(false);
            }}
          >
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-gold" aria-hidden="true" />
                  {t('legal.advisoryQueue.dispatchPanel.title', {
                    defaultValue: 'Send advisory to counterparty',
                  })}
                </DialogTitle>
                <DialogDescription>
                  {t('legal.advisoryQueue.dispatchPanel.description', {
                    defaultValue:
                      'Recipient pre-filled from the contract counterparty. Edit if you need to and click Send.',
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="dispatch-recipient-name"
                    className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
                  >
                    {t('legal.advisoryQueue.dispatchPanel.nameLabel', {
                      defaultValue: 'Recipient name',
                    })}
                  </label>
                  <Input
                    id="dispatch-recipient-name"
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="dispatch-recipient-email"
                    className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
                  >
                    {t('legal.advisoryQueue.dispatchPanel.emailLabel', {
                      defaultValue: 'Recipient email',
                    })}
                  </label>
                  <Input
                    id="dispatch-recipient-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDispatchConfirm(false)}
                  disabled={dispatchMutation.isPending}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={() => dispatchMutation.mutate()}
                  disabled={!recipientEmail || !recipientName || dispatchMutation.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  {dispatchMutation.isPending
                    ? t('common.saving', { defaultValue: 'Sending…' })
                    : t('legal.advisoryQueue.dispatchPanel.send', { defaultValue: 'Send' })}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialogs */}
          {showModify && (
            <AdvisoryModifyDialog
              draft={draft}
              isOpen={showModify}
              onClose={() => setShowModify(false)}
              onSuccess={() => setShowModify(false)}
            />
          )}

          {showReject && (
            <AdvisoryRejectDialog
              draftId={draft.id}
              isOpen={showReject}
              onClose={() => setShowReject(false)}
              onSuccess={() => setShowReject(false)}
            />
          )}

        </>
      )}
    </motion.div>
  );
}

