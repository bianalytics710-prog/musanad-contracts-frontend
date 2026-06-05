/**
 * ExecutiveBudgetBurnSection — "Contract Spend Health" rollup (mig 563).
 *
 * Renamed from "Budget Burn" to "Contract Spend Health". Pulls from the
 * canonical /api/v1/financial/budget-burn endpoint (fn_budget_burn_portfolio)
 * directly rather than the stale budgetBurnSummary slice on the exec
 * dashboard payload — guarantees the rollup and the Budget Burn module
 * always agree on every number.
 *
 * Layout (two-line story):
 *   Top    — scope:   Tracked with budget X of Y · Without budget Z
 *   Bottom — forward: Currently over budget (YTD) N · Projected to overrun
 *                     by FY end M contracts · AED A.A
 *
 * Below that: top 3 contracts trending toward FY-end overrun (the
 * actionable leaderboard the executive needs for "where do I dig in?").
 */
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Wallet, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import { financialBudgetBurnService } from '@/services/api/financial-budget-burn.service';

function formatAedCompact(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
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

export function ExecutiveBudgetBurnSection({
  budgetBurnSummary: _legacyProp, // kept for caller compat; ignored
}: {
  budgetBurnSummary?: unknown;
}) {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['budget-burn-portfolio-rollup'],
    queryFn: () => financialBudgetBurnService.getPortfolio({}),
    staleTime: 60_000,
  });

  if (isLoading || isError || !data) return null;

  const summary = data.summary;
  const contractsWithBudget = summary.contractsWithBudget ?? 0;
  if (contractsWithBudget === 0) return null;

  const contractsTotalCount = summary.contractsTotalCount ?? contractsWithBudget;
  const overBudgetCount = summary.overBudgetContractCount ?? summary.overBudgetCount ?? 0;
  const trendingOverCount = summary.trendingOverContractCount ?? 0;
  const projectedOverrunAed = summary.totalProjectedOverrunAed;
  const projectedOverrun = parseFloat(projectedOverrunAed || '0');
  const topProjected = data.topProjectedOverrun3 ?? [];

  return (
    <section
      aria-label={t('financial.spendHealth.sectionLabel', {
        defaultValue: 'Contract spend health',
      })}
      className="rounded-lg border border-border bg-card p-4"
    >
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-gold" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-ink">
            {t('financial.spendHealth.title', { defaultValue: 'Contract Spend Health' })}
          </h3>
        </div>
        <Link
          to="/app/financial/budget-burn"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={t('financial.spendHealth.viewAllAriaLabel', {
            defaultValue: 'Open Contract Spend Health module',
          })}
        >
          {t('financial.spendHealth.viewAll', { defaultValue: 'View all' })}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* Scope row — single tile (Without-budget tile dropped per user
          request; the X-of-Y line carries the same signal). */}
      <div className="mb-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">
            {t('financial.spendHealth.trackedWithBudget', {
              defaultValue: 'Tracked with budget',
            })}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {t('financial.spendHealth.xOfYActiveContracts', {
              defaultValue: '{{x}} of {{y}} active contracts',
              x: contractsWithBudget,
              y: contractsTotalCount,
            })}
          </p>
          <p className="mt-1 text-[11px] text-ink-subtle">
            {t('financial.spendHealth.scopeNote', {
              defaultValue: 'Line-item budgets are set up on these contracts only.',
            })}
          </p>
        </div>
      </div>

      {/* Forward row — actionable status */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className={`rounded-lg border p-3 ${overBudgetCount > 0 ? 'border-terracotta/30 bg-terracotta/5' : 'border-border bg-surface'}`}
        >
          <p className="text-xs text-ink-muted">
            {t('financial.spendHealth.currentlyOver', {
              defaultValue: 'Currently over budget (YTD)',
            })}
          </p>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums ${overBudgetCount > 0 ? 'text-terracotta' : 'text-success'}`}
          >
            {overBudgetCount}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 ${projectedOverrun > 0 ? 'border-terracotta/30 bg-terracotta/5' : 'border-border bg-surface'}`}
        >
          <p className="text-xs text-ink-muted">
            {t('financial.spendHealth.projectedToOverrun', {
              defaultValue: 'Projected to overrun by FY end',
            })}
          </p>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums ${projectedOverrun > 0 ? 'text-terracotta' : 'text-success'}`}
          >
            {trendingOverCount > 0
              ? t('financial.spendHealth.projectedSummary', {
                  defaultValue: '{{n}} contracts · {{aed}}',
                  n: trendingOverCount,
                  aed: formatAedCompact(projectedOverrunAed),
                })
              : t('financial.spendHealth.allWithinTrack', {
                  defaultValue: 'All within track',
                })}
          </p>
        </div>
      </div>

      {/* Top 3 projected overruns */}
      {topProjected.length > 0 && (
        <div>
          <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            {t('financial.spendHealth.topProjected', {
              defaultValue: 'Top projected overruns',
            })}
          </p>
          <div className="space-y-2">
            {topProjected.map((row) => {
              const overAed = parseFloat(row.projectedOverUnderAed || '0');
              return (
                <div
                  key={row.contractId}
                  className="flex items-center justify-between gap-3 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {row.contractNumber}
                    </p>
                    <p className="truncate text-[11px] text-ink-muted">{row.titleEn}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-flex items-center rounded-md bg-terracotta/15 px-2 py-0.5 font-mono text-xs font-semibold text-terracotta">
                      +{formatAedCompact(overAed)}
                    </span>
                    <p className="mt-0.5 text-[11px] tabular-nums text-ink-subtle">
                      {t('financial.spendHealth.projectedAbbrev', {
                        defaultValue: 'projected over',
                      })}
                    </p>
                  </div>
                  <Link
                    to="/app/financial/budget-burn/$contractId"
                    params={{ contractId: String(row.contractId) }}
                    className="shrink-0 rounded p-1 text-ink-muted hover:text-terracotta focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={t('financial.spendHealth.viewContractAriaLabel', {
                      defaultValue: 'View detail for {{number}}',
                      number: row.contractNumber,
                    })}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calm-state copy when nothing is currently over AND nothing is trending */}
      {overBudgetCount === 0 && topProjected.length === 0 && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p className="flex-1 text-xs text-ink">
            {t('financial.spendHealth.allHealthy', {
              defaultValue:
                'All {{count}} tracked contracts are within budget and trending on track.',
              count: contractsWithBudget,
            })}
          </p>
        </div>
      )}
    </section>
  );
}
