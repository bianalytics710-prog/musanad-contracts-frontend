/**
 * /app/financial/budget-burn/:contractId — Contract detail view.
 *
 * CR-N — M21 Financial Intelligence. Primary persona: finance_treasury.
 *
 * Sections:
 *   1. Budget-vs-actual by period × cost category (table + burn bars)
 *   2. Variance alert banner (when day-rate breaches threshold)
 *   3. Correlated cure-period + liquidated-damages clause refs
 *   4. Year-end projection card
 *   5. Cumulative burn trend (period rows)
 *   6. "Draft cure notice" action (gated advisory.draft.review)
 *
 * Standards: A7, C13, C14, D6, D7, T3, T4, T10, T11, T12, WCAG AA, RTL logical classes.
 */
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCcw,
  FileEdit,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { financialBudgetBurnService } from '@/services/api/financial-budget-burn.service';
import { translateApiError } from '@/lib/translate-api-error';
import type {
  BudgetBurnByPeriod,
  BudgetBurnByCategory,
  VarianceBreach,
  CorrelatedClauseRef,
  LdClauseRef,
  BudgetYearEndProjection,
  ProjectionConfidence,
  CumulativeBurnRow,
} from '@/types/entities/budget-burn.types';

export const Route = createFileRoute(
  '/app/financial/budget-burn/$contractId',
)({
  component: () => (
    <ErrorBoundary>
      <BudgetBurnDetailView />
    </ErrorBoundary>
  ),
});

// ─────────────────────────────────────────────────────────────
// AED formatter — parse string→float, full and compact (C13: no raw hex)
// ─────────────────────────────────────────────────────────────
function formatAedFull(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `AED ${n.toFixed(0)}`;
  }
}

function formatAedCompact(raw: string | null | undefined): string {
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
    return `AED ${n.toFixed(0)}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Confidence badge colours (C13 — semantic tokens only)
// ─────────────────────────────────────────────────────────────
const CONFIDENCE_COLORS: Record<ProjectionConfidence, string> = {
  high:              'bg-success/10 text-success border-success/30',
  medium:            'bg-warning/10 text-warning border-warning/30',
  low:               'bg-amber/10 text-amber border-amber/30',
  insufficient_data: 'bg-muted text-ink-muted border-border',
};

// ─────────────────────────────────────────────────────────────
// Main detail view
// ─────────────────────────────────────────────────────────────
function BudgetBurnDetailView() {
  const { t } = useTranslation();
  const { contractId } = Route.useParams();
  const numericContractId = Number(contractId);

  const canRead       = useAuthStore(selectHasPermission('finance.budget.read'));
  const canDraftNotice = useAuthStore(selectHasPermission('advisory.draft.review'));

  // Burn compute (periods + monthly actuals + cumulative)
  const burnQuery = useQuery({
    queryKey: ['budget-burn-compute', numericContractId],
    queryFn: () => financialBudgetBurnService.getBurnCompute(numericContractId),
    enabled: canRead && !isNaN(numericContractId),
    staleTime: 30_000,
  });

  // Variance (breaches + clause refs + eligibility)
  const varianceQuery = useQuery({
    queryKey: ['budget-burn-variance', numericContractId],
    queryFn: () => financialBudgetBurnService.getVariance(numericContractId),
    enabled: canRead && !isNaN(numericContractId),
    staleTime: 30_000,
  });

  // Year-end projection
  const projectionQuery = useQuery({
    queryKey: ['budget-burn-projection', numericContractId],
    queryFn: () => financialBudgetBurnService.getProjection(numericContractId),
    enabled: canRead && !isNaN(numericContractId),
    staleTime: 30_000,
  });

  const burn       = burnQuery.data;
  const variance   = varianceQuery.data;
  const projection = projectionQuery.data;

  const isLoading = burnQuery.isLoading || varianceQuery.isLoading || projectionQuery.isLoading;
  const isError   = burnQuery.isError || varianceQuery.isError || projectionQuery.isError;
  const anyError  = burnQuery.error ?? varianceQuery.error ?? projectionQuery.error;

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
      {/* Back nav (C14: Router Link) */}
      <div>
        <Link
          to="/app/financial/budget-burn"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={t('financial.budgetBurn.detail.backToPortfolio')}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('financial.budgetBurn.detail.backToPortfolio')}
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4" aria-busy="true">
          <div className="h-8 w-64 animate-pulse rounded bg-surface" aria-hidden="true" />
          <div className="h-48 animate-pulse rounded-lg bg-surface" aria-hidden="true" />
          <div className="h-32 animate-pulse rounded-lg bg-surface" aria-hidden="true" />
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
            {translateApiError(anyError, t, 'financial.budgetBurn.errors.fetchFailed')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void burnQuery.refetch();
              void varianceQuery.refetch();
              void projectionQuery.refetch();
            }}
          >
            <RefreshCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && burn && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {burn.contractNumber}
              </h1>
              <p className="mt-0.5 text-sm text-ink-muted">{burn.titleEn}</p>
              {burn.titleAr && (
                <p className="text-xs text-ink-subtle" dir="rtl">
                  {burn.titleAr}
                </p>
              )}
            </div>
            {/* Draft cure notice action — gated advisory.draft.review */}
            {canDraftNotice && variance?.cureNoticeEligible && (
              <DraftCureNoticeButton contractId={numericContractId} />
            )}
          </div>

          {/* Summary KPI strip */}
          <section
            aria-label={t('financial.budgetBurn.detail.summaryLabel')}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          >
            <KpiTile
              label={t('financial.budgetBurn.detail.kpis.totalBudget')}
              value={formatAedCompact(burn.totalBudgetedAed)}
            />
            <KpiTile
              label={t('financial.budgetBurn.detail.kpis.totalActual')}
              value={formatAedCompact(burn.totalActualAed)}
            />
            <KpiTile
              label={t('financial.budgetBurn.detail.kpis.variance')}
              value={formatAedCompact(burn.totalVarianceAed)}
              variant={parseFloat(burn.totalVarianceAed) > 0 ? 'risk' : 'success'}
            />
            <KpiTile
              label={t('financial.budgetBurn.detail.kpis.variancePct')}
              value={`${burn.totalVariancePct >= 0 ? '+' : ''}${burn.totalVariancePct.toFixed(1)}%`}
              variant={burn.totalVariancePct > 0 ? 'risk' : 'success'}
            />
            <KpiTile
              label={t('financial.budgetBurn.detail.kpis.pctConsumed')}
              value={`${burn.burnRatePct.toFixed(1)}%`}
              variant={burn.burnRatePct >= 100 ? 'risk' : burn.burnRatePct >= 80 ? 'warning' : 'default'}
            />
            <KpiTile
              label={t('financial.budgetBurn.detail.kpis.remaining')}
              value={formatAedCompact(burn.remainingBudgetAed)}
              variant={parseFloat(burn.remainingBudgetAed) < 0 ? 'risk' : 'default'}
            />
          </section>

          {/* ── VARIANCE ALERT BANNER ───────────────────────────────── */}
          {variance && variance.breachCount > 0 && (
            <VarianceAlertBanner variance={variance.breaches} maxPct={variance.maxVariancePct} />
          )}

          {/* ── BUDGET vs ACTUAL BY PERIOD × CATEGORY ──────────────── */}
          <PeriodCategoryTable byPeriod={burn.byPeriod} />

          {/* ── CORRELATED CLAUSE REFS ─────────────────────────────── */}
          {variance && (
            <CorrelatedClausesSection
              curePeriod={variance.correlatedClauses.curePeriod}
              liquidatedDamages={variance.correlatedClauses.liquidatedDamages}
            />
          )}

          {/* ── YEAR-END PROJECTION CARD ───────────────────────────── */}
          {projection && <YearEndProjectionCard projection={projection} />}

          {/* ── CUMULATIVE BURN TREND ──────────────────────────────── */}
          {burn.cumulativeBurn.length > 0 && (
            <CumulativeBurnSection rows={burn.cumulativeBurn} />
          )}
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// KpiTile
// ─────────────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string;
  variant?: 'default' | 'risk' | 'warning' | 'success';
}) {
  const containerClass =
    variant === 'risk'    ? 'border-terracotta/30 bg-terracotta/5' :
    variant === 'warning' ? 'border-warning/30 bg-warning/5' :
    variant === 'success' ? 'border-success/30 bg-success/5' :
                            'border-border bg-card';

  const valueClass =
    variant === 'risk'    ? 'text-terracotta' :
    variant === 'warning' ? 'text-warning' :
    variant === 'success' ? 'text-success' :
                            'text-ink';

  return (
    <div className={`rounded-lg border p-4 ${containerClass}`}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VarianceAlertBanner — day-rate (or other category) breach banner
// ─────────────────────────────────────────────────────────────
function VarianceAlertBanner({
  variance,
  maxPct,
}: {
  variance: VarianceBreach[];
  maxPct: number;
}) {
  const { t } = useTranslation();

  // Surface the worst breach prominently (highest variancePct)
  const worst = [...variance].sort((a, b) => b.variancePct - a.variancePct)[0];
  if (!worst) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-terracotta/30 bg-terracotta/5 p-4"
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-terracotta">
          {t('financial.budgetBurn.varianceAlert.title')}
        </p>
        <p className="mt-0.5 text-xs text-ink">
          {t('financial.budgetBurn.varianceAlert.body', {
            category: t(`financial.budgetBurn.costCategory.${worst.costCategory}`),
            period: worst.periodLabel,
            pct: worst.variancePct.toFixed(1),
          })}
        </p>
        {variance.length > 1 && (
          <p className="mt-1 text-xs text-ink-muted">
            {t('financial.budgetBurn.varianceAlert.totalBreaches', {
              count: variance.length,
              maxPct: maxPct.toFixed(1),
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PeriodCategoryTable — budget vs actual by period × category
// ─────────────────────────────────────────────────────────────
function PeriodCategoryTable({ byPeriod }: { byPeriod: BudgetBurnByPeriod[] }) {
  const { t } = useTranslation();

  if (byPeriod.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">
          {t('financial.budgetBurn.detail.periodTable.heading')}
        </h2>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            {t('financial.budgetBurn.detail.periodTable.empty')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">
        {t('financial.budgetBurn.detail.periodTable.heading')}
      </h2>
      <div className="space-y-4">
        {byPeriod.map((period) => (
          <PeriodBlock key={period.periodLabel} period={period} />
        ))}
      </div>
    </section>
  );
}

function PeriodBlock({ period }: { period: BudgetBurnByPeriod }) {
  const { t } = useTranslation();
  const variancePct = period.variancePct ?? 0;
  const isOver = variancePct > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Period header row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="text-xs font-semibold text-ink">{period.periodLabel}</span>
        <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
          <span className="text-ink-muted">
            {t('financial.budgetBurn.detail.periodTable.budget')}{' '}
            <span className="text-ink">{formatAedCompact(period.budgetAed)}</span>
          </span>
          <span className="text-ink-muted">
            {t('financial.budgetBurn.detail.periodTable.actual')}{' '}
            <span className="text-ink">{formatAedCompact(period.actualAed)}</span>
          </span>
          <span className={isOver ? 'text-terracotta' : 'text-success'}>
            {isOver ? '+' : ''}{variancePct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Category breakdown */}
      {period.byCategory.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-surface/50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-ink-muted">
                  {t('financial.budgetBurn.columns.category')}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('financial.budgetBurn.columns.budget')}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('financial.budgetBurn.columns.actual')}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                  {t('financial.budgetBurn.columns.variance')}
                </th>
                <th scope="col" className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-ink-muted">
                  {t('financial.budgetBurn.detail.periodTable.burnBar')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {period.byCategory.map((cat) => (
                <CategoryRow key={cat.costCategory} cat={cat} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategoryRow({ cat }: { cat: BudgetBurnByCategory }) {
  const { t } = useTranslation();
  const variancePct = cat.variancePct ?? 0;
  const isOver = variancePct > 0;
  const budget = parseFloat(cat.budgetAed);
  const actual = parseFloat(cat.actualAed);
  const burnPct = budget > 0 ? Math.min(120, (actual / budget) * 100) : 0;

  return (
    <tr className={`transition-colors hover:bg-surface/50 ${cat.overThreshold ? 'bg-terracotta/3' : ''}`}>
      <td className="px-4 py-2 font-medium text-ink">
        {t(`financial.budgetBurn.costCategory.${cat.costCategory}`)}
        {cat.overThreshold && (
          <AlertTriangle
            className="ms-1.5 inline h-3 w-3 text-terracotta"
            aria-label={t('financial.budgetBurn.varianceFlag.overThreshold')}
          />
        )}
      </td>
      <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
        {formatAedFull(cat.budgetAed)}
      </td>
      <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
        {formatAedFull(cat.actualAed)}
      </td>
      <td className={`px-4 py-2 text-right font-mono tabular-nums ${isOver ? 'text-terracotta' : 'text-success'}`}>
        {isOver ? '+' : ''}{variancePct.toFixed(1)}%
      </td>
      <td className="px-4 py-2">
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full ${burnPct >= 100 ? 'bg-terracotta' : burnPct >= 80 ? 'bg-warning' : 'bg-success'}`}
            style={{ width: `${Math.min(100, burnPct)}%` }}
            role="presentation"
            aria-label={t('financial.budgetBurn.detail.periodTable.burnBarAriaLabel', {
              pct: burnPct.toFixed(0),
            })}
          />
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// CorrelatedClausesSection
// ─────────────────────────────────────────────────────────────
function CorrelatedClausesSection({
  curePeriod,
  liquidatedDamages,
}: {
  curePeriod: CorrelatedClauseRef[];
  liquidatedDamages: LdClauseRef[];
}) {
  const { t } = useTranslation();
  const hasAny = curePeriod.length > 0 || liquidatedDamages.length > 0;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">
        {t('financial.budgetBurn.detail.correlatedClauses.heading')}
      </h2>
      {!hasAny ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-xs text-ink-muted">
            {t('financial.budgetBurn.detail.correlatedClauses.noClausesFound')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Cure period refs */}
          {curePeriod.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {t('financial.budgetBurn.detail.correlatedClauses.curePeriod')}
              </p>
              {curePeriod.map((ref) => (
                <div
                  key={ref.clauseId}
                  className="mb-2 flex items-start gap-2 text-xs"
                >
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-ink">
                      {t('financial.budgetBurn.detail.correlatedClauses.clauseId', {
                        id: ref.clauseId,
                        page: ref.pageNo,
                      })}
                    </p>
                    {ref.curePeriodDays !== null && (
                      <p className="text-ink-muted">
                        {t('financial.budgetBurn.detail.correlatedClauses.curePeriodDays', {
                          days: ref.curePeriodDays,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LD clause refs */}
          {liquidatedDamages.length > 0 && (
            <div className="rounded-lg border border-terracotta/20 bg-terracotta/5 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-terracotta">
                {t('financial.budgetBurn.detail.correlatedClauses.liquidatedDamages')}
              </p>
              {liquidatedDamages.map((ref) => (
                <div
                  key={ref.clauseId}
                  className="mb-2 flex items-start gap-2 text-xs"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-ink">
                      {t('financial.budgetBurn.detail.correlatedClauses.clauseId', {
                        id: ref.clauseId,
                        page: ref.pageNo,
                      })}
                    </p>
                    {ref.ldRate !== null && (
                      <p className="text-ink-muted">
                        {t('financial.budgetBurn.detail.correlatedClauses.ldRate', {
                          rate: formatAedCompact(ref.ldRate),
                        })}
                      </p>
                    )}
                    {ref.ldCap !== null && (
                      <p className="text-ink-muted">
                        {t('financial.budgetBurn.detail.correlatedClauses.ldCap', {
                          cap: formatAedCompact(ref.ldCap),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// YearEndProjectionCard
// ─────────────────────────────────────────────────────────────
function YearEndProjectionCard({ projection }: { projection: BudgetYearEndProjection }) {
  const { t } = useTranslation();
  const isInsufficient = projection.confidenceNote === 'insufficient_data';
  const isOverBudget   = projection.isProjectedOverBudget === true;

  const confidenceClass = CONFIDENCE_COLORS[projection.confidenceNote];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">
        {t('financial.budgetBurn.detail.projection.heading')}
      </h2>
      <div className={`rounded-lg border p-5 ${isOverBudget ? 'border-terracotta/30 bg-terracotta/5' : 'border-border bg-card'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-muted">
              {t('financial.budgetBurn.detail.projection.fiscalYear', {
                year: projection.fiscalYear,
                asOf: projection.asOfPeriod,
              })}
            </p>
            <div className="mt-1 flex items-center gap-2">
              {isOverBudget ? (
                <TrendingUp className="h-5 w-5 text-terracotta" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-5 w-5 text-success" aria-hidden="true" />
              )}
              <p className={`text-2xl font-bold tabular-nums ${isOverBudget ? 'text-terracotta' : 'text-success'}`}>
                {isInsufficient
                  ? t('financial.budgetBurn.detail.projection.insufficient')
                  : formatAedCompact(projection.projectedOverUnderAed)}
              </p>
              {!isInsufficient && projection.projectedOverUnderPct !== null && (
                <span className={`text-sm font-medium ${isOverBudget ? 'text-terracotta' : 'text-success'}`}>
                  ({isOverBudget ? '+' : ''}{projection.projectedOverUnderPct.toFixed(1)}%)
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              {isOverBudget
                ? t('financial.budgetBurn.detail.projection.projectedOverBudget')
                : t('financial.budgetBurn.detail.projection.projectedUnderBudget')}
            </p>
          </div>

          <div className="text-right">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${confidenceClass}`}
            >
              {t(`financial.budgetBurn.detail.projection.confidence.${projection.confidenceNote}`)}
            </span>
          </div>
        </div>

        {/* Detail grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-ink-muted">{t('financial.budgetBurn.detail.projection.allocatedFy')}</p>
            <p className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
              {formatAedCompact(projection.allocatedFyAed)}
            </p>
          </div>
          <div>
            <p className="text-ink-muted">{t('financial.budgetBurn.detail.projection.actualToDate')}</p>
            <p className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
              {formatAedCompact(projection.actualToDateAed)}
            </p>
          </div>
          <div>
            <p className="text-ink-muted">{t('financial.budgetBurn.detail.projection.runRate')}</p>
            <p className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
              {formatAedCompact(projection.runRatePerMonthAed)}
              <span className="text-ink-muted">/mo</span>
            </p>
          </div>
          <div>
            <p className="text-ink-muted">{t('financial.budgetBurn.detail.projection.monthsRemaining')}</p>
            <p className="mt-0.5 font-semibold text-ink">{projection.monthsRemaining}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// CumulativeBurnSection — period-over-period cumulative trend
// ─────────────────────────────────────────────────────────────
function CumulativeBurnSection({ rows }: { rows: CumulativeBurnRow[] }) {
  const { t } = useTranslation();

  // Find max for normalising bar widths
  const maxVal = rows.reduce((m, r) => {
    return Math.max(m, parseFloat(r.cumulativeBudgetAed), parseFloat(r.cumulativeActualAed));
  }, 1);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">
        {t('financial.budgetBurn.detail.cumulativeBurn.heading')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-ink-muted">
                {t('financial.budgetBurn.detail.cumulativeBurn.period')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                {t('financial.budgetBurn.detail.cumulativeBurn.cumBudget')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                {t('financial.budgetBurn.detail.cumulativeBurn.cumActual')}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-ink-muted">
                {t('financial.budgetBurn.detail.cumulativeBurn.trend')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.map((row) => {
              const actualN = parseFloat(row.cumulativeActualAed);
              const budgetN = parseFloat(row.cumulativeBudgetAed);
              const budgetPct = (budgetN / maxVal) * 100;
              const actualPct = (actualN / maxVal) * 100;
              const isOver = actualN > budgetN;

              return (
                <tr key={row.periodLabel} className="transition-colors hover:bg-surface/50">
                  <td className="px-4 py-3 font-medium text-ink">{row.periodLabel}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                    {formatAedCompact(row.cumulativeBudgetAed)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${isOver ? 'text-terracotta' : 'text-ink'}`}>
                    {formatAedCompact(row.cumulativeActualAed)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative h-3 w-32 overflow-hidden rounded-full bg-surface">
                      {/* Budget bar */}
                      <div
                        className="absolute inset-y-0 start-0 rounded-full bg-muted"
                        style={{ width: `${budgetPct}%` }}
                        role="presentation"
                      />
                      {/* Actual bar */}
                      <div
                        className={`absolute inset-y-0 start-0 h-1.5 rounded-full ${isOver ? 'bg-terracotta' : 'bg-success'}`}
                        style={{ width: `${actualPct}%`, top: '50%', transform: 'translateY(-50%)' }}
                        role="presentation"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// DraftCureNoticeButton — gated advisory.draft.review
// ─────────────────────────────────────────────────────────────
function DraftCureNoticeButton({ contractId }: { contractId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      financialBudgetBurnService.draftCureNotice(contractId, {}),
    onSuccess: (res) => {
      toast.success(
        t('financial.budgetBurn.detail.draftCureNotice.successToast', {
          draftId: res.draftId,
          defaultValue: 'Cure notice draft #{{draftId}} created.',
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['budget-burn-variance', contractId] });
    },
    onError: (err: unknown) => {
      toast.error(
        translateApiError(err, t, 'financial.budgetBurn.detail.draftCureNotice.errorToast'),
      );
    },
  });

  return (
    <Button
      variant="outline"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      aria-label={t('financial.budgetBurn.detail.draftCureNotice.ariaLabel')}
    >
      <FileEdit className="me-2 h-4 w-4" aria-hidden="true" />
      {mutation.isPending
        ? t('common.saving')
        : t('financial.budgetBurn.detail.draftCureNotice.button')}
    </Button>
  );
}

