/**
 * /app/financial/budget-burn — Portfolio list (index).
 *
 * CR-N — M21 Financial Intelligence. Primary persona: finance_treasury.
 * Read access: finance_treasury, procurement_supplier_risk, operations,
 *              executive, platform_admin, Super Admin.
 *
 * Standards:
 *   A7:  all HTTP via financialBudgetBurnService
 *   C13: no raw hex — semantic tokens only
 *   C14: Router Link for internal nav
 *   D6:  htmlFor+id on filter labels
 *   D7:  scope="col" on all <th>
 *   T3:  all strings via t()
 *   T4:  loading / empty / error states
 *   T10: useDebounce(300) not applicable (no search input — filter only)
 *   T11: ErrorBoundary at route level
 *   T12: formatDateTime for timestamps
 */
import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCcw, ChevronRight, TrendingUp } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { financialBudgetBurnService } from '@/services/api/financial-budget-burn.service';
import { translateApiError } from '@/lib/translate-api-error';
import type {
  PortfolioContractRow,
  PortfolioQuery,
} from '@/types/entities/budget-burn.types';

export const Route = createFileRoute('/app/financial/budget-burn/')({
  component: () => (
    <ErrorBoundary>
      <BudgetBurnPortfolioView />
    </ErrorBoundary>
  ),
});

// ─────────────────────────────────────────────────────────────
// AED formatter — parse string→float, compact display (C13: no raw hex)
// ─────────────────────────────────────────────────────────────
function formatAed(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    if (n >= 1_000_000_000) return `AED ${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
    return `AED ${n.toFixed(0)}`;
  }
}

function formatPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────
function BudgetBurnPortfolioView() {
  const { t } = useTranslation();
  const canRead = useAuthStore(selectHasPermission('finance.budget.read'));

  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const params = useMemo<PortfolioQuery>(
    () => ({ page, limit: LIMIT }),
    [page],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['budget-burn-portfolio', params],
    queryFn: () => financialBudgetBurnService.getPortfolio(params),
    enabled: canRead,
    staleTime: 30_000,
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;
  const pagination = data?.pagination;

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t('financial.budgetBurn.portfolio.title')}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('financial.budgetBurn.portfolio.subtitle')}
        </p>
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
            {translateApiError(error, t, 'financial.budgetBurn.errors.fetchFailed')}
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
          {/* Portfolio summary strip */}
          {summary && (
            <section
              aria-label={t('financial.budgetBurn.portfolio.summaryLabel')}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
            >
              <SummaryTile
                label={t('financial.budgetBurn.portfolio.summary.contractsWithBudget')}
                value={String(summary.contractsWithBudget)}
              />
              <SummaryTile
                label={t('financial.budgetBurn.portfolio.summary.totalBudget')}
                value={formatAed(summary.totalBudgetAed)}
              />
              <SummaryTile
                label={t('financial.budgetBurn.portfolio.summary.totalActual')}
                value={formatAed(summary.totalActualAed)}
              />
              <SummaryTile
                label={t('financial.budgetBurn.portfolio.summary.totalVariance')}
                value={formatAed(summary.totalVarianceAed)}
                variant={parseFloat(summary.totalVarianceAed) > 0 ? 'risk' : 'default'}
              />
              <SummaryTile
                label={t('financial.budgetBurn.portfolio.summary.overBudgetCount')}
                value={String(summary.overBudgetCount)}
                variant={summary.overBudgetCount > 0 ? 'warning' : 'default'}
              />
              <SummaryTile
                label={t('financial.budgetBurn.portfolio.summary.totalProjectedOverrun')}
                value={formatAed(summary.totalProjectedOverrunAed)}
                variant={parseFloat(summary.totalProjectedOverrunAed) > 0 ? 'risk' : 'default'}
              />
            </section>
          )}

          {rows.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card">
              <TrendingUp className="h-8 w-8 text-ink-subtle" aria-hidden="true" />
              <p className="text-sm font-medium text-ink">
                {t('financial.budgetBurn.portfolio.empty.title')}
              </p>
              <p className="text-xs text-ink-muted">
                {t('financial.budgetBurn.portfolio.empty.body')}
              </p>
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
                      {t('financial.budgetBurn.columns.contract')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      {t('financial.budgetBurn.columns.counterparty')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                    >
                      {t('financial.budgetBurn.columns.budget')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                    >
                      {t('financial.budgetBurn.columns.actual')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                    >
                      {t('financial.budgetBurn.columns.consumed')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                    >
                      {t('financial.budgetBurn.columns.projectedOverUnder')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      {t('financial.budgetBurn.columns.status')}
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
                  {rows.map((row) => (
                    <PortfolioRow key={row.contractId} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Offset pagination */}
          {pagination && pagination.total > LIMIT && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-ink-muted">
                {t('financial.budgetBurn.portfolio.showing', {
                  from: (page - 1) * LIMIT + 1,
                  to: Math.min(page * LIMIT, pagination.total),
                  total: pagination.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label={t('common.pagination.prev')}
                >
                  {t('common.pagination.prev')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * LIMIT >= pagination.total}
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
// SummaryTile — KPI tile
// ─────────────────────────────────────────────────────────────
function SummaryTile({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string;
  variant?: 'default' | 'warning' | 'risk';
}) {
  const containerClass =
    variant === 'risk'
      ? 'border-terracotta/30 bg-terracotta/5'
      : variant === 'warning'
        ? 'border-warning/30 bg-warning/5'
        : 'border-border bg-card';

  const valueClass =
    variant === 'risk'
      ? 'text-terracotta'
      : variant === 'warning'
        ? 'text-warning'
        : 'text-ink';

  return (
    <div className={`rounded-lg border p-4 ${containerClass}`}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PortfolioRow — single contract row
// ─────────────────────────────────────────────────────────────
function PortfolioRow({ row }: { row: PortfolioContractRow }) {
  const { t } = useTranslation();

  const varianceClass = row.varianceFlag
    ? 'text-terracotta'
    : 'text-success';

  const projectedAed = parseFloat(row.projectedOverUnderAed);
  const projectedClass = projectedAed > 0 ? 'text-terracotta' : 'text-success';

  return (
    <tr className="transition-colors hover:bg-surface/50">
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{row.contractNumber}</p>
        <p className="text-xs text-ink-muted">{row.titleEn}</p>
        {row.titleAr && (
          <p className="text-xs text-ink-subtle" dir="rtl">
            {row.titleAr}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-ink-muted">
        {row.counterpartyName ?? '—'}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-ink">
        {formatAed(row.budgetAed)}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-ink">
        {formatAed(row.actualAed)}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sm">
        <span className={row.pctConsumed >= 100 ? 'text-terracotta' : 'text-ink'}>
          {row.pctConsumed.toFixed(1)}%
        </span>
      </td>
      <td className={`px-4 py-3 text-right font-mono tabular-nums text-sm ${projectedClass}`}>
        {projectedAed > 0 ? '+' : ''}{formatAed(row.projectedOverUnderAed)}
      </td>
      <td className="px-4 py-3">
        {row.varianceFlag ? (
          <span className="inline-flex items-center rounded-full border border-terracotta/30 bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium text-terracotta">
            {t('financial.budgetBurn.varianceFlag.over')}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
            {t('financial.budgetBurn.varianceFlag.onTrack')}
          </span>
        )}
        {/* Burn bar */}
        <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full transition-all ${row.pctConsumed >= 100 ? 'bg-terracotta' : row.pctConsumed >= 80 ? 'bg-warning' : 'bg-success'}`}
            style={{ width: `${Math.min(100, row.pctConsumed)}%` }}
            role="presentation"
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <Link
          to="/app/financial/budget-burn/$contractId"
          params={{ contractId: String(row.contractId) }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t('financial.budgetBurn.portfolio.viewDetail', {
            number: row.contractNumber,
          })}
        >
          {t('financial.budgetBurn.portfolio.viewDetails')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}
