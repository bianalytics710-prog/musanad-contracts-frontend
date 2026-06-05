/**
 * /app/admin/risk-review — Tier 2 manual triage (Phase C, relocated).
 *
 * Lives under Workflow & rules. Surfaces borderline risk-case alerts the
 * correlation engine wasn't confident enough to auto-route (confidence
 * 0.60–0.85 OR no matching routing rule). The business admin scans the
 * queue, then either:
 *   - Confirm risk → runs fn_risk_review_promote → assigned_role cleared,
 *     fn_risk_case_classify_and_route fires, case lands in the matching
 *     specialist team's queue with the rule's SLA.
 *   - Mark as noise → runs fn_risk_review_dismiss → status='closed',
 *     closure_outcome='no_action'. Audit trail retained.
 *
 * Bulk checkbox + bulk-action buttons match the same pattern.
 *
 * Permission: risk.review.manage. Grant lives on platform_admin +
 * Super Admin (executive was revoked by migration 552).
 */
import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, ShieldCheck, ShieldOff } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { riskReviewService, type RiskReviewRow } from '@/services/api/risk-review.service';
import { RiskTypePill } from '@/components/risk/RiskTypePill';
import { formatAedCompact } from '@/features/dashboards/components/dashboard-primitives';
import { formatDateTime } from '@/utils/datetime';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/app/admin/risk-review')({
  component: () => (
    <ErrorBoundary>
      <RiskReviewAdminPage />
    </ErrorBoundary>
  ),
});

function RiskReviewAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canManage = useAuthStore(selectHasPermission('risk.review.manage'));

  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Routing-preview confirm modal. Holds the row the user clicked
  // "Confirm risk" on; the modal renders preview_role + preview_sla_hours
  // and the Assign button runs the actual promote.
  const [confirming, setConfirming] = useState<RiskReviewRow | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['adminRiskReview', 25],
    // Admin view shows more than the dashboard preview did.
    queryFn: () => riskReviewService.list(25),
    staleTime: 30_000,
    enabled: canManage,
  });

  const rows: RiskReviewRow[] = useMemo(() => data?.rows ?? [], [data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['adminRiskReview'] });
    void queryClient.invalidateQueries({ queryKey: ['riskCases'] });
  };

  const promoteOne = useMutation({
    mutationFn: (id: number) => riskReviewService.promote(id),
    onSuccess: () => {
      toast.success(t('riskReview.toast.promoted', { defaultValue: 'Risk confirmed and routed' }));
      invalidate();
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  const dismissOne = useMutation({
    mutationFn: (id: number) => riskReviewService.dismiss(id),
    onSuccess: () => {
      toast.success(t('riskReview.toast.dismissed', { defaultValue: 'Marked as noise' }));
      invalidate();
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  const bulk = useMutation({
    mutationFn: ({ action, ids }: { action: 'promote' | 'dismiss'; ids: number[] }) =>
      riskReviewService.bulk(action, ids),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === 'promote'
          ? t('riskReview.toast.bulkPromoted', {
              defaultValue: '{{n}} risks confirmed',
              n: vars.ids.length,
            })
          : t('riskReview.toast.bulkDismissed', {
              defaultValue: '{{n}} marked as noise',
              n: vars.ids.length,
            }),
      );
      setSelected(new Set());
      invalidate();
    },
    onError: () => toast.error(t('common.error', { defaultValue: 'Action failed' })),
  });

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber/30 bg-amber/10 p-4">
          <p className="text-sm text-ink">
            {t('riskReview.permissionRequired', {
              defaultValue:
                'You need the risk.review.manage permission to view this page.',
            })}
          </p>
        </div>
      </div>
    );
  }

  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllVisible = () => setSelected(new Set(rows.map((r) => Number(r.id))));
  const clearSelection = () => setSelected(new Set());

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1200px] space-y-4 p-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {t('riskReview.adminTitle', { defaultValue: 'Risk review' })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('riskReview.adminSubtitle', {
              defaultValue:
                'Borderline alerts the engine routed here for manual judgement (confidence 0.60–0.85, or no matching routing rule). Confirm to send to the specialist team via the routing matrix, or mark as noise to close.',
            })}
          </p>
        </div>
      </header>

      {/* Tier explainer banner */}
      <div className="rounded-lg border border-amber/30 bg-amber/5 p-3 text-xs text-ink">
        <p>
          <strong>{t('riskReview.howItWorks', { defaultValue: 'How this queue is populated' })}:</strong>{' '}
          {t('riskReview.howItWorksBody', {
            defaultValue:
              'Correlations with confidence ≥ 0.85 AND a matching rule auto-route directly to specialist queues (Tier 1). Anything with confidence 0.60–0.85 OR no matching rule lands here for review (Tier 2). Below 0.60 confidence is suppressed entirely (Tier 3) — see Risk routing for the rule list.',
          })}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selected.size === rows.length ? clearSelection : selectAllVisible}
            className="rounded text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-gold/60"
          >
            {selected.size === rows.length
              ? t('riskReview.clearSelection', { defaultValue: 'Clear selection' })
              : t('riskReview.selectAll', { defaultValue: 'Select all' })}
          </button>
          {selected.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => bulk.mutate({ action: 'promote', ids: [...selected] })}
                disabled={bulk.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-sage/40 bg-sage/10 px-2 py-1 text-sage hover:bg-sage/20 focus:outline-none focus:ring-2 focus:ring-sage/60 disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t('riskReview.bulkConfirm', { defaultValue: 'Confirm {{n}}', n: selected.size })}
              </button>
              <button
                type="button"
                onClick={() => bulk.mutate({ action: 'dismiss', ids: [...selected] })}
                disabled={bulk.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-ink-muted hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:opacity-50"
              >
                <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                {t('riskReview.bulkDismiss', {
                  defaultValue: 'Mark {{n}} as noise',
                  n: selected.size,
                })}
              </button>
            </>
          )}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {(error as Error)?.message ??
            t('common.error', { defaultValue: 'Failed to load Risk Review.' })}
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <p className="rounded-lg border border-border bg-card py-8 text-center text-sm text-ink-muted">
          {t('riskReview.empty', {
            defaultValue:
              'No borderline alerts pending review. The engine routed everything with high confidence.',
          })}
        </p>
      )}

      <Dialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('riskReview.confirmModal.title', { defaultValue: 'Confirm risk assignment' })}
            </DialogTitle>
            <DialogDescription>
              {t('riskReview.confirmModal.body', {
                defaultValue:
                  'Based on the routing matrix, this case will be assigned to the team below. Members of that role can claim and act on it from the Risk Cases queue.',
              })}
            </DialogDescription>
          </DialogHeader>

          {confirming && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <RiskTypePill type={confirming.risk_type} />
                <span className="text-xs text-ink-subtle">
                  {t('riskReview.confidence', {
                    defaultValue: 'Confidence {{c}}',
                    c: (confirming.confidence * 100).toFixed(0) + '%',
                  })}
                </span>
              </div>

              <div className="rounded-md border border-border bg-paper-2 p-3">
                <p className="mb-1 text-xs text-ink-subtle">
                  {t('riskReview.confirmModal.willAssignTo', {
                    defaultValue: 'Will be assigned to:',
                  })}
                </p>
                <p className="text-base font-semibold text-ink">
                  {confirming.preview_role_display ??
                    t('riskReview.confirmModal.noMatch', {
                      defaultValue: 'Operations (catch-all rule)',
                    })}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {t('riskReview.confirmModal.sla', {
                    defaultValue: 'SLA: {{h}} hours',
                    h: confirming.preview_sla_hours ?? 24,
                  })}
                </p>
              </div>

              {confirming.contract_number && (
                <p className="text-xs text-ink-muted">
                  {t('riskReview.confirmModal.contract', { defaultValue: 'Contract:' })}{' '}
                  <span className="font-mono text-ink">{confirming.contract_number}</span>
                  {confirming.counterparty_name && (
                    <>
                      {' · '}
                      {confirming.counterparty_name}
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(null)}
              disabled={promoteOne.isPending}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (confirming) {
                  promoteOne.mutate(Number(confirming.id), {
                    onSuccess: () => setConfirming(null),
                  });
                }
              }}
              disabled={promoteOne.isPending}
            >
              {promoteOne.isPending
                ? t('common.submitting', { defaultValue: 'Assigning…' })
                : t('riskReview.confirmModal.assign', { defaultValue: 'Assign' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isLoading && !isError && rows.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {rows.map((row) => {
            const id = Number(row.id);
            const isSelected = selected.has(id);
            return (
              <li
                key={row.id}
                className={cn(
                  'flex items-start gap-3 p-3 transition-colors',
                  isSelected ? 'bg-gold/5' : 'hover:bg-surface/50',
                )}
              >
                <input
                  id={`risk-review-row-${row.id}`}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOne(id)}
                  aria-label={t('riskReview.selectRowAria', {
                    defaultValue: 'Select this case',
                  })}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                />
                <div className="flex-1">
                  {/* 2026-06-04 — title row dropped per platform-admin
                      feedback. Same treatment as the Critical Impact
                      frame: lead with risk type + Tier badge; the
                      description carries the narrative. Auto-generated
                      titles like "USD/AED peg deviation 0.38%..." would
                      vary wildly in production and don't read as the
                      scannable label. */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <RiskTypePill type={row.risk_type} />
                    <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
                      {t('riskReview.tier2Badge', { defaultValue: 'Tier 2 · Review' })}
                    </span>
                  </div>
                  {row.description && (
                    <p className="mb-2 text-sm text-ink-muted">{row.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
                    {row.contract_id && row.contract_number && (
                      <Link
                        to="/app/contracts/$id"
                        params={{ id: row.contract_id }}
                        className="font-mono text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-gold/60 rounded"
                      >
                        {row.contract_number}
                      </Link>
                    )}
                    {row.counterparty_name && <span>{row.counterparty_name}</span>}
                    {row.value_aed && (
                      <span>
                        {t('riskReview.value', {
                          defaultValue: 'Value {{v}}',
                          v: formatAedCompact(Number(row.value_aed)),
                        })}
                      </span>
                    )}
                    <span>
                      {t('riskReview.confidence', {
                        defaultValue: 'Confidence {{c}}',
                        c: (row.confidence * 100).toFixed(0) + '%',
                      })}
                    </span>
                    <span>
                      {t('riskReview.occurredAt', {
                        defaultValue: 'received {{when}}',
                        when: formatDateTime(row.created_at),
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(row)}
                    disabled={promoteOne.isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-sage/40 bg-sage/10 px-2 py-1 text-xs text-sage hover:bg-sage/20 focus:outline-none focus:ring-2 focus:ring-sage/60 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('riskReview.confirmRisk', { defaultValue: 'Confirm risk' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissOne.mutate(id)}
                    disabled={dismissOne.isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-ink-muted hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:opacity-50"
                  >
                    <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('riskReview.markNoise', { defaultValue: 'Mark as noise' })}
                  </button>
                  {row.contract_id && (
                    <Link
                      to="/app/risk-cases/$caseId"
                      params={{ caseId: row.id }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:bg-muted focus:outline-none focus:ring-2 focus:ring-gold/60"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('riskReview.viewDetail', { defaultValue: 'View' })}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
