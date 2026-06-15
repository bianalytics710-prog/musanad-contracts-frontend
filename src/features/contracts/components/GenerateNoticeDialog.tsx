/**
 * 2026-06-15 — Two-step draft-notice dialog (Phase 1).
 *
 * Step 1: Template picker.
 * Step 2: Server-rendered preview (EN/AR) + 3 buttons:
 *   - Cancel
 *   - Send for executive review → routes the draft for exec approval
 *   - Send directly → caller passes onSendDirectly callback (which opens
 *     the ConfirmSendDialog to choose recipients before dispatch)
 *
 * On the FIRST click of either path, we POST /from-risk-case with
 * reviewPath=NULL to PRE-RENDER the body server-side. After the user
 * commits to a path:
 *   - executive_review: POST /route-for-review on the draft id
 *   - send_directly: hand the draft to the parent which opens
 *     ConfirmSendDialog (handles recipient editing).
 *
 * Importing this dialog gives any surface (header button, Notices tab)
 * the same flow with a single state — see ContractDetail header + the
 * Notices tab for two entry points.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { advisoryDraftsService } from '@/services/api/advisory-drafts.service';

// ─── Template catalog (matches advisory_template seed) ───────────────────
const TEMPLATE_CATALOG = [
  { id: 3,  templateId: 'cure_notice_v1',           draftType: 'cure_notice',     label: 'Cure Notice' },
  { id: 1,  templateId: 'hormuz_fm_invocation_v1',  draftType: 'fm_invocation',   label: 'Force Majeure Invocation' },
  { id: 2,  templateId: 'sanctions_hold_v1',        draftType: 'sanctions_hold',  label: 'Sanctions Hold' },
  { id: 7,  templateId: 'esg_concern_memo_v1',      draftType: 'esg_concern',     label: 'ESG Concern Memo' },
  { id: 10, templateId: 'budget_cure_notice_v1',    draftType: 'cure_notice',     label: 'Budget Variance Cure Notice' },
  { id: 8,  templateId: 'insurance_renewal_reminder_v1', draftType: 'insurance_renewal', label: 'Insurance Renewal Reminder' },
] as const;
export type TemplateKey = (typeof TEMPLATE_CATALOG)[number]['id'];

// Map risk-case risk_type → preselected template id.
// 2026-06-15 — BE returns slugs without the "_event" suffix
// (force_majeure, sanctions, sla, budget, esg). Accept both spellings.
function preselectedTemplateForRiskType(riskType: string | null | undefined): TemplateKey | null {
  if (!riskType) return null;
  const t = riskType.toLowerCase();
  if (t.startsWith('force_majeure')) return 1;     // FM Invocation
  if (t.startsWith('sanctions'))     return 2;     // Sanctions Hold
  if (t.startsWith('budget'))        return 10;    // Budget Variance Cure
  if (t.startsWith('sla'))           return 3;     // Cure Notice
  if (t.startsWith('esg'))           return 7;     // ESG Concern Memo
  return null;
}

// Sensible demo defaults for Mustache vars used across templates.
function defaultContext(contractNumber: string, counterpartyName: string | null): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const cureEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    notice_date: today,
    contract_id: contractNumber,
    addressee: `Director, ${counterpartyName ?? 'Counterparty'}`,
    counterparty_name: counterpartyName ?? 'Counterparty',
    breach_description: 'Material breach of contract terms identified during regular review.',
    cure_period_days: '30',
    cure_period_end_date: cureEnd,
    cure_address: 'Legal Affairs Division — legal@adnoc.ae',
    sanctioning_authority: 'OFAC (U.S. Treasury)',
    designation_date: today,
    hold_basis: 'OFAC SDN list designation triggers sanctions screening policy; performance suspension required.',
    fm_clause_text: '21.2 (Force Majeure)',
    signal_date: today,
    signal_summary: 'Force majeure event confirmed via OSINT signals.',
    notice_period_days: '7',
    concern_summary: 'OSINT review surfaced credible reports of ESG concern.',
    source_url: 'https://example.local/source',
    sub_contractor_name: 'Tier-2 supplier',
    prime_counterparty_name: counterpartyName ?? 'Counterparty',
    recommended_review: 'Compliance ESG review within 5 business days.',
  };
}

export interface GenerateNoticeDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contractId: number;
  contractNumber: string;
  counterpartyName: string | null;
  riskCaseId: number | null;
  riskType?: string | null;
  /** Called after the user picks send_directly. Parent should open ConfirmSendDialog. */
  onPickSendDirectly: (draft: { id: number; draftType: string; linkedRiskCaseId: number | null }) => void;
  /** Called after the user picks executive_review and the route call succeeds. */
  onRoutedForReview: () => void;
  /**
   * 2026-06-15 — Called when the user clicks "Send now" on an
   * approved-ready-to-send draft. Parent should open ConfirmSendDialog
   * in send_after_review mode.
   */
  onPickSendAfterReview: (draft: { id: number; draftType: string; linkedRiskCaseId: number | null }) => void;
}

export function GenerateNoticeDialog({
  open,
  onOpenChange,
  contractId,
  contractNumber,
  counterpartyName,
  riskCaseId,
  riskType,
  onPickSendDirectly,
  onRoutedForReview,
  onPickSendAfterReview,
}: GenerateNoticeDialogProps) {
  const { t } = useTranslation();
  const initialTemplate: TemplateKey =
    preselectedTemplateForRiskType(riskType) ?? 3;
  // 'routed' = sent for executive review, awaiting exec action
  // 'approved' = exec approved (or modified+approved), waiting for LC to dispatch
  const [step, setStep] = useState<1 | 2 | 'routed' | 'approved'>(1);
  const [templateId, setTemplateId] = useState<TemplateKey>(initialTemplate);
  const [previewLang, setPreviewLang] = useState<'en' | 'ar'>('en');
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftEn, setDraftEn] = useState<string>('');
  const [draftAr, setDraftAr] = useState<string>('');
  const [draftType, setDraftType] = useState<string>('');

  // 2026-06-15 — check whether an in-flight routed draft already exists
  // for THIS CONTRACT (not just this risk case — the user might navigate
  // here without a riskCase URL param, but we still want them to see
  // "Awaiting executive review" if they already routed earlier). Prefer
  // matching on linkedRiskCaseId when we know it, otherwise pick the
  // most-recent contract-wide routed draft.
  const existingDraftsQuery = useQuery({
    queryKey: ['contractAdvisories', contractId],
    queryFn: () => advisoryDraftsService.listByContract(contractId),
    enabled: open,
    staleTime: 10_000,
  });
  // 2026-06-15 — an "in-flight" draft is any draft on this contract that
  // hasn't been dispatched. We classify it as 'routed' (still on the
  // executive's plate) or 'approved' (handed back to legal counsel,
  // ready to send) so the dialog opens on the right state.
  const inFlightDraft = useMemo(() => {
    const rows = existingDraftsQuery.data;
    if (!rows) return null;
    const inFlight = rows.filter(
      (d) =>
        !d.dispatchedAt &&
        // Either still awaiting exec, or exec approved → LC.
        ((d.currentReviewer === 'executive' && d.approvalStatus === 'unapproved') ||
          (d.currentReviewer === 'legal_counsel' && d.approvalStatus === 'approved')),
    );
    if (inFlight.length === 0) return null;
    if (riskCaseId) {
      const byCase = inFlight.find((d) => d.linkedRiskCaseId === String(riskCaseId));
      if (byCase) return byCase;
    }
    return inFlight.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0] ?? null;
  }, [existingDraftsQuery.data, riskCaseId]);

  // Decide which step the dialog should open on, based on the draft's state.
  const inFlightStep: 'routed' | 'approved' | null = useMemo(() => {
    if (!inFlightDraft) return null;
    if (inFlightDraft.currentReviewer === 'legal_counsel' && inFlightDraft.approvalStatus === 'approved') {
      return 'approved';
    }
    return 'routed';
  }, [inFlightDraft]);

  // Reset internal state when the dialog opens/closes so reopening starts
  // fresh OR resumes the in-flight draft's state (routed / approved).
  useEffect(() => {
    if (open) {
      setTemplateId(initialTemplate);
      setPreviewLang('en');
      if (inFlightDraft && inFlightStep) {
        setStep(inFlightStep);
        setDraftId(inFlightDraft.id);
        setDraftEn(inFlightDraft.finalTextEn ?? inFlightDraft.generatedTextEn ?? '');
        setDraftAr(inFlightDraft.finalTextAr ?? inFlightDraft.generatedTextAr ?? '');
        setDraftType(inFlightDraft.draftType);
      } else {
        setStep(1);
        setDraftId(null);
        setDraftEn('');
        setDraftAr('');
        setDraftType('');
      }
    }
  }, [open, initialTemplate, inFlightDraft, inFlightStep]);

  const ctx = useMemo(
    () => defaultContext(contractNumber, counterpartyName),
    [contractNumber, counterpartyName],
  );

  // Step 1 → Step 2: generate the draft server-side with reviewPath=NULL.
  // The fn renders Mustache + returns rendered text via a follow-up fetch.
  const generateMutation = useMutation({
    mutationFn: async () => {
      const created = await advisoryDraftsService.generateFromRiskCase({
        templateId,
        contractId,
        riskCaseId,
        // 2026-06-15: deferred path selection — reviewPath set in step 2.
        reviewPath: undefined as never,
        templateContext: ctx,
      });
      // Fetch the rendered EN/AR text via the contract advisory list (it
      // includes generatedTextEn/Ar). Cheaper than another GET /:id call.
      const list = await advisoryDraftsService.listByContract(contractId);
      const row = list.find((r) => r.id === created.id);
      return {
        id: created.id,
        draftType: created.draftType,
        linkedRiskCaseId: created.linkedRiskCaseId,
        en: row?.generatedTextEn ?? '',
        ar: row?.generatedTextAr ?? '',
      };
    },
    onSuccess: (data) => {
      setDraftId(data.id);
      setDraftType(data.draftType);
      setDraftEn(data.en);
      setDraftAr(data.ar);
      setStep(2);
    },
    onError: (e) => toast.error(
      t('contracts.notices.generateError', {
        defaultValue: "Couldn't generate notice: {{msg}}",
        msg: (e as Error).message,
      }),
    ),
  });

  // Step 2 actions: send_directly or executive_review (committed AFTER preview).
  const routeMutation = useMutation({
    mutationFn: (id: number) => advisoryDraftsService.routeForReview(id),
    onSuccess: () => {
      onRoutedForReview();
      // 2026-06-15 — show the routed state INSIDE the dialog instead of
      // closing. User can re-open later and see the same routed state
      // (driven by the existingDraftsQuery on next mount).
      setStep('routed');
      toast.success(
        t('contracts.notices.routedToastV2', {
          defaultValue: 'Sent to executive for review.',
        }),
      );
    },
    onError: (e) => toast.error(
      t('contracts.notices.routeError', {
        defaultValue: "Couldn't route for review: {{msg}}",
        msg: (e as Error).message,
      }),
    ),
  });

  const handleSendDirectly = () => {
    if (!draftId) return;
    onPickSendDirectly({ id: draftId, draftType, linkedRiskCaseId: riskCaseId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? t('contracts.notices.generate.title', { defaultValue: 'Draft notice' })
              : step === 2
              ? t('contracts.notices.generate.previewTitle', { defaultValue: 'Review the draft' })
              : step === 'routed'
              ? t('contracts.notices.generate.routedTitle', { defaultValue: 'Awaiting executive review' })
              : t('contracts.notices.generate.approvedTitle', { defaultValue: 'Approved — ready to send' })}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? t('contracts.notices.generate.description', { defaultValue: 'Pick a template — you’ll see the full notice before choosing how to send it.' })
              : step === 2
              ? t('contracts.notices.generate.previewDescription', { defaultValue: 'This is what will be sent. Choose Send directly, or route to the executive for review.' })
              : step === 'routed'
              ? t('contracts.notices.generate.routedDescription', { defaultValue: 'You have already sent this notice for executive review. You will be notified once it is approved.' })
              : t('contracts.notices.generate.approvedDescription', { defaultValue: 'The executive has approved this notice. Click Send to dispatch it to the counterparty.' })}
          </DialogDescription>
        </DialogHeader>

        {step === 'approved' ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 rounded-md border border-[var(--sage)]/40 bg-[var(--sage)]/5 px-3 py-2 text-sm text-ink">
              <Clock className="h-4 w-4 text-[var(--sage)]" aria-hidden />
              {t('contracts.notices.generate.approvedBanner', {
                defaultValue: 'Executive approved. Click Send to dispatch to the counterparty.',
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {t('contracts.notices.generate.previewLabel', { defaultValue: 'Notice preview' })}
              </span>
              <div className="inline-flex rounded-md border border-input text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreviewLang('en')}
                  className={`px-2 py-0.5 ${previewLang === 'en' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
                >EN</button>
                <button
                  type="button"
                  onClick={() => setPreviewLang('ar')}
                  className={`px-2 py-0.5 ${previewLang === 'ar' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
                  disabled={!draftAr}
                >AR</button>
              </div>
            </div>
            <pre
              className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface/40 p-4 text-xs leading-relaxed text-ink"
              data-testid="gen-approved-preview-body"
            >
              {previewLang === 'en' ? draftEn : draftAr}
            </pre>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="button"
                disabled={!draftId}
                onClick={() => {
                  if (!draftId) return;
                  onPickSendAfterReview({ id: draftId, draftType, linkedRiskCaseId: riskCaseId });
                  onOpenChange(false);
                }}
                data-testid="gen-send-now"
              >
                {t('contracts.notices.generate.sendNow', { defaultValue: 'Send now' })}
              </Button>
            </DialogFooter>
          </div>
        ) : step === 'routed' ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 rounded-md border border-gold/40 bg-gold/5 px-3 py-2 text-sm text-ink">
              <Clock className="h-4 w-4 text-gold" aria-hidden />
              {t('contracts.notices.generate.routedBanner', {
                defaultValue: 'Sent to executive — you will be notified when they approve or modify.',
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {t('contracts.notices.generate.previewLabel', { defaultValue: 'Notice preview' })}
              </span>
              <div className="inline-flex rounded-md border border-input text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreviewLang('en')}
                  className={`px-2 py-0.5 ${previewLang === 'en' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
                >EN</button>
                <button
                  type="button"
                  onClick={() => setPreviewLang('ar')}
                  className={`px-2 py-0.5 ${previewLang === 'ar' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
                  disabled={!draftAr}
                >AR</button>
              </div>
            </div>
            <pre
              className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface/40 p-4 text-xs leading-relaxed text-ink"
              data-testid="gen-routed-preview-body"
            >
              {previewLang === 'en' ? draftEn : draftAr}
            </pre>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.close', { defaultValue: 'Close' })}
              </Button>
            </DialogFooter>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="gen-template" className="mb-1 block text-xs font-medium text-ink-muted">
                {t('contracts.notices.generate.template', { defaultValue: 'Notice type' })}
              </label>
              <select
                id="gen-template"
                value={templateId}
                onChange={(e) => setTemplateId(Number(e.target.value) as TemplateKey)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TEMPLATE_CATALOG.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.label}</option>
                ))}
              </select>
            </div>
            {riskCaseId && (
              <div className="rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-[11px] text-ink">
                {t('contracts.notices.generate.linkedCase', {
                  defaultValue: 'Will be linked to Risk Case #{{id}}.',
                  id: riskCaseId,
                })}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="button"
                disabled={generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
                data-testid="gen-next-preview"
              >
                {generateMutation.isPending
                  ? t('contracts.notices.generate.rendering', { defaultValue: 'Rendering…' })
                  : t('contracts.notices.generate.next', { defaultValue: 'Next — preview' })}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {t('contracts.notices.generate.previewLabel', { defaultValue: 'Notice preview' })}
              </span>
              <div className="inline-flex rounded-md border border-input text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreviewLang('en')}
                  className={`px-2 py-0.5 ${previewLang === 'en' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
                >EN</button>
                <button
                  type="button"
                  onClick={() => setPreviewLang('ar')}
                  className={`px-2 py-0.5 ${previewLang === 'ar' ? 'bg-surface text-ink' : 'text-ink-muted'}`}
                  disabled={!draftAr}
                >AR</button>
              </div>
            </div>
            {generateMutation.isPending ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <pre
                className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface/40 p-4 text-xs leading-relaxed text-ink"
                data-testid="gen-preview-body"
              >
                {previewLang === 'en' ? draftEn : draftAr}
              </pre>
            )}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                disabled={routeMutation.isPending}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t('contracts.notices.generate.back', { defaultValue: 'Back' })}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={routeMutation.isPending || !draftId}
                onClick={() => draftId && routeMutation.mutate(draftId)}
                data-testid="gen-route-review"
              >
                {t('contracts.notices.generate.routeReview', { defaultValue: 'Send for executive review' })}
              </Button>
              <Button
                type="button"
                disabled={!draftId}
                onClick={handleSendDirectly}
                data-testid="gen-send-directly"
              >
                {t('contracts.notices.generate.sendDirectly', { defaultValue: 'Send directly' })}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
