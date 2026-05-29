/**
 * ExecutiveBudgetBurnSection — CR-N M21 Financial Intelligence.
 *
 * Additive "Budget Burn" rollup section for the Executive Dashboard.
 * Consumes the `budgetBurnSummary` key (10th top-level key added to
 * fn_dashboard_executive output by CR-N DB migration).
 *
 * Pattern mirrors AvarDashboardSection + ExecutiveCrgExtension:
 *   - Receives data as prop (caller casts the intersection type)
 *   - Renders nothing (null) when data is absent or overBudgetCount === 0
 *     AND contractsWithBudget === 0 (defensive: no data yet)
 *   - C13: no raw hex — semantic tokens only
 *   - T3:  all strings via t()
 *   - C14: Router Link for internal nav
 */
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react';
import type { BudgetBurnSummary } from '@/types/entities/budget-burn.types';

// ─────────────────────────────────────────────────────────────
// AED compact formatter (C13: no raw hex)
// ─────────────────────────────────────────────────────────────
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

interface Props {
  budgetBurnSummary: BudgetBurnSummary | null | undefined;
}

export function ExecutiveBudgetBurnSection({ budgetBurnSummary }: Props) {
  const { t } = useTranslation();

  // Defensive: render nothing when key absent (pre-migration or no budgets)
  if (!budgetBurnSummary) return null;
  if (budgetBurnSummary.contractsWithBudget === 0) return null;

  const { contractsWithBudget, overBudgetCount, totalProjectedOverrunAed, topOverBudget3 } =
    budgetBurnSummary;

  const hasOverrun = overBudgetCount > 0;
  const projectedOverrun = parseFloat(totalProjectedOverrunAed);

  return (
    <section
      aria-label={t('financial.budgetBurn.executive.sectionLabel')}
      className="rounded-lg border border-border bg-card p-4"
    >
      {/* Section header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gold" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-ink">
            {t('financial.budgetBurn.executive.title')}
          </h3>
        </div>
        {/* C14: Router Link for internal nav */}
        <Link
          to="/app/financial/budget-burn"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={t('financial.budgetBurn.executive.viewAllAriaLabel')}
        >
          {t('financial.budgetBurn.executive.viewAll')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">
            {t('financial.budgetBurn.executive.contractsWithBudget')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {contractsWithBudget}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 ${hasOverrun ? 'border-terracotta/30 bg-terracotta/5' : 'border-border bg-surface'}`}
        >
          <p className="text-xs text-ink-muted">
            {t('financial.budgetBurn.executive.overBudgetCount')}
          </p>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums ${hasOverrun ? 'text-terracotta' : 'text-success'}`}
          >
            {overBudgetCount}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 ${projectedOverrun > 0 ? 'border-warning/30 bg-warning/5' : 'border-border bg-surface'}`}
        >
          <p className="text-xs text-ink-muted">
            {t('financial.budgetBurn.executive.projectedOverrun')}
          </p>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums ${projectedOverrun > 0 ? 'text-warning' : 'text-success'}`}
          >
            {formatAedCompact(totalProjectedOverrunAed)}
          </p>
        </div>
      </div>

      {/* Top over-budget contracts */}
      {topOverBudget3.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('financial.budgetBurn.executive.topOverBudget')}
          </p>
          <div className="space-y-2">
            {topOverBudget3.map((row) => (
              <div
                key={row.contractId}
                className="flex items-center justify-between gap-3 rounded-md border border-terracotta/20 bg-terracotta/5 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">
                    {row.contractNumber}
                  </p>
                  <p className="truncate text-[11px] text-ink-muted">{row.titleEn}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold tabular-nums text-terracotta">
                    +{row.variancePct.toFixed(1)}%
                  </p>
                  <p className="text-[11px] tabular-nums text-ink-muted">
                    {formatAedCompact(row.varianceAed)} {t('financial.budgetBurn.executive.over')}
                  </p>
                </div>
                <Link
                  to="/app/financial/budget-burn/$contractId"
                  params={{ contractId: String(row.contractId) }}
                  className="shrink-0 rounded p-1 text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={t('financial.budgetBurn.executive.viewContractAriaLabel', {
                    number: row.contractNumber,
                  })}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* On-track banner when all contracts within budget */}
      {overBudgetCount === 0 && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-success" aria-hidden="true" />
          <p className="text-xs text-success">
            {t('financial.budgetBurn.executive.allOnTrack', {
              count: contractsWithBudget,
            })}
          </p>
        </div>
      )}
    </section>
  );
}
