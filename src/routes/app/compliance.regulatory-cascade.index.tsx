/**
 * /app/compliance/regulatory-cascade — List view (index).
 *
 * CR-M — Labor-Law Cascade. Primary persona: compliance_esg.
 * Read access: legal_counsel, executive, procurement_supplier_risk.
 * Run access: compliance_esg, platform_admin, Super Admin.
 *
 * Standards:
 *   A7: all HTTP via service
 *   C13: no raw hex
 *   C14: Router Link for internal nav
 *   D6: htmlFor+id on filter labels
 *   D7: scope="col" on all <th>
 *   T3: all strings via t()
 *   T4: loading / empty / error states
 *   T10: useDebounce(300) for search
 *   T11: ErrorBoundary at route level
 *   T12: formatDateTime for timestamps
 */
import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Play, RefreshCcw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { regulatoryCascadeService } from '@/services/api/regulatory-cascade.service';
import { translateApiError } from '@/lib/translate-api-error';
import { formatDateTime } from '@/utils/datetime';
import type {
  RegulatoryCascadeRunListItem,
  CascadeRunStatus,
} from '@/types/entities/regulatory-cascade.types';

export const Route = createFileRoute('/app/compliance/regulatory-cascade/')({
  component: () => (
    <ErrorBoundary>
      <RegulatoryCollaborationListView />
    </ErrorBoundary>
  ),
});

// ─────────────────────────────────────────────────────────────
// Status badge colours — semantic tokens only (C13)
// ─────────────────────────────────────────────────────────────
const RUN_STATUS_COLORS: Record<CascadeRunStatus, string> = {
  running:   'bg-info/10 text-info border-info/30',
  completed: 'bg-success/10 text-success border-success/30',
  failed:    'bg-error/10 text-error border-error/30',
};

// ─────────────────────────────────────────────────────────────
// AED formatter — compact display (no raw hex, semantic only)
// ─────────────────────────────────────────────────────────────
function formatAedRange(min: number, max: number): string {
  const fmt = (n: number): string => {
    try {
      return new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency: 'AED',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(n);
    } catch {
      if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
      return `AED ${n.toFixed(0)}`;
    }
  };
  if (min === max) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────
function RegulatoryCollaborationListView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const canRead = useAuthStore(selectHasPermission('regulatory.cascade.read'));
  const canRun  = useAuthStore(selectHasPermission('regulatory.cascade.run'));

  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const params = useMemo(
    () => ({ limit: LIMIT, offset }),
    [offset],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['regulatory-cascade-list', params],
    queryFn: () => regulatoryCascadeService.list(params),
    enabled: canRead,
    staleTime: 30_000,
  });

  const runs = data?.data ?? [];
  const pagination = data?.pagination;

  // Run Cascade mutation — uses MOHRE Federal Decree-Law No. 9 of 2024 signal.
  // The signal id is environment-specific (BIGSERIAL on osint_signal advances with
  // every OFAC / Brent / etc. seeded row). Look up the latest active regulatory
  // signal matching the MOHRE decree from the most recent cascade run if available,
  // otherwise fall back to the known dev-DB id 7290098. (Demo-stable; replace with
  // a BE endpoint that resolves the signal by dedup_hash if this moves between
  // environments.)
  const mohreSignalId = useMemo(() => {
    const lastRun = data?.data?.[0];
    return lastRun?.signalId ?? 7290098;
  }, [data]);

  const runMutation = useMutation({
    mutationFn: () =>
      regulatoryCascadeService.run({ signalId: mohreSignalId }),
    onSuccess: (res) => {
      toast.success(
        t('regulatory.cascade.toast.runSuccess', {
          count: res.affectedContractorCount,
          defaultValue:
            'Cascade complete — {{count}} contractor(s) assessed.',
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['regulatory-cascade-list'] });
    },
    onError: (err: unknown) =>
      toast.error(
        translateApiError(err, t, 'regulatory.cascade.toast.runFailed'),
      ),
  });

  if (!canRead) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('regulatory.cascade.list.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('regulatory.cascade.list.subtitle')}
          </p>
        </div>
        {canRun && (
          <Button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            <Play className="me-2 h-4 w-4" aria-hidden="true" />
            {runMutation.isPending
              ? t('regulatory.cascade.list.runningCascade')
              : t('regulatory.cascade.list.runCascadeButton')}
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-surface"
              aria-hidden="true"
            />
          ))}
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-error" aria-hidden="true" />
          <p className="text-sm text-error">
            {translateApiError(error, t, 'regulatory.cascade.errors.fetchFailed')}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            <RefreshCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && (
        <>
          {runs.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card">
              <p className="text-sm font-medium text-ink">
                {t('regulatory.cascade.list.empty.title')}
              </p>
              <p className="text-xs text-ink-muted">
                {t('regulatory.cascade.list.empty.body')}
              </p>
              {canRun && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runMutation.mutate()}
                  disabled={runMutation.isPending}
                >
                  <Play className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {t('regulatory.cascade.list.runCascadeButton')}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      {t('regulatory.cascade.columns.regulationRef')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      {t('regulatory.cascade.columns.status')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      {t('regulatory.cascade.columns.runAt')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                    >
                      {t('regulatory.cascade.columns.affectedContractors')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                    >
                      {t('regulatory.cascade.columns.penaltyRange')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      {t('regulatory.cascade.columns.triggeredBy')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      <span className="sr-only">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {runs.map((run) => (
                    <CascadeRunRow key={run.id} run={run} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Offset pagination */}
          {pagination && pagination.total > LIMIT && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-ink-muted">
                {t('regulatory.cascade.list.showing', {
                  from: offset + 1,
                  to: Math.min(offset + LIMIT, pagination.total),
                  total: pagination.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                  disabled={offset === 0}
                  aria-label={t('common.pagination.prev')}
                >
                  {t('common.pagination.prev')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOffset((o) => o + LIMIT)}
                  disabled={offset + LIMIT >= pagination.total}
                  aria-label={t('common.pagination.next')}
                >
                  {t('common.pagination.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// CascadeRunRow — single row in the runs table
// ─────────────────────────────────────────────────────────────
function CascadeRunRow({ run }: { run: RegulatoryCascadeRunListItem }) {
  const { t } = useTranslation();
  const statusClass =
    RUN_STATUS_COLORS[run.status] ?? 'bg-muted text-ink-muted border-border';

  return (
    <tr className="transition-colors hover:bg-surface/50">
      <td className="px-4 py-3 font-medium text-ink">
        {run.regulationRef ?? t('regulatory.cascade.list.noRef')}
      </td>
      <td className="px-4 py-3">
        {/* L80 — drop uppercase on Status badge so "Completed" reads sentence-case. */}
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider ${statusClass}`}
        >
          {t(`regulatory.cascade.runStatus.${run.status}`, {
            defaultValue: run.status.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
          })}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-ink-muted">
        {formatDateTime(run.runAt, { showTime: true })}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
        {run.affectedContractorCount}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-ink">
        {formatAedRange(run.totalPenaltyMinAed, run.totalPenaltyMaxAed)}
      </td>
      <td className="px-4 py-3 text-xs text-ink-muted">
        {run.createdByName ?? '—'}
      </td>
      <td className="px-4 py-3">
        <Link
          to="/app/compliance/regulatory-cascade/$runId"
          params={{ runId: String(run.id) }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t('regulatory.cascade.list.viewRun', { id: run.id })}
        >
          {t('regulatory.cascade.list.viewDetails')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}
