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
      toast.success(t('legal.advisoryQueue.toast.dispatched'));
      void qc.invalidateQueries({ queryKey: ['advisoryDrafts'] });
      setShowDispatchConfirm(false);
      setRecipientEmail('');
      setRecipientName('');
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'legal.advisoryQueue.errors.dispatchFailed'));
    },
  });

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
              <h1 className="text-2xl font-semibold text-ink">
                {t('legal.advisoryQueue.detailTitle', { id: draft.id })}
              </h1>
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

              {/* Dispatch — only after approved */}
              {canDoDispatch && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDispatchConfirm(true)}
                >
                  <Send className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {t('legal.advisoryQueue.actions.dispatch')}
                </Button>
              )}
            </div>
          </div>

          {/* Draft preview */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <AdvisoryDraftPreview draft={draft} />
          </div>

          {/* Dispatch confirmation inline panel */}
          {showDispatchConfirm && (
            <div
              className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
              role="region"
              aria-label={t('legal.advisoryQueue.dispatchPanel.title')}
            >
              <h2 className="text-base font-semibold text-ink">
                {t('legal.advisoryQueue.dispatchPanel.title')}
              </h2>
              <p className="text-sm text-ink-muted">
                {t('legal.advisoryQueue.dispatchPanel.description')}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="dispatch-recipient-email" className="mb-1 block text-sm font-medium text-ink">
                    {t('legal.advisoryQueue.dispatchPanel.emailLabel')}
                  </label>
                  <Input
                    id="dispatch-recipient-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder={t('legal.advisoryQueue.dispatchPanel.emailPlaceholder')}
                  />
                </div>
                <div>
                  <label htmlFor="dispatch-recipient-name" className="mb-1 block text-sm font-medium text-ink">
                    {t('legal.advisoryQueue.dispatchPanel.nameLabel')}
                  </label>
                  <Input
                    id="dispatch-recipient-name"
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={t('legal.advisoryQueue.dispatchPanel.namePlaceholder')}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowDispatchConfirm(false)}
                  disabled={dispatchMutation.isPending}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={() => dispatchMutation.mutate()}
                  disabled={
                    !recipientEmail || !recipientName || dispatchMutation.isPending
                  }
                >
                  {dispatchMutation.isPending
                    ? t('common.saving')
                    : t('legal.advisoryQueue.dispatchPanel.confirm')}
                </Button>
              </div>
            </div>
          )}

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
