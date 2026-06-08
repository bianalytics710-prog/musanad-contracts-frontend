/**
 * ExecutiveTradeMarginSection — Index-Linked Contracts rollup on the
 * Executive Dashboard.
 *
 * mig 592 revamp: the section now leads with the action-oriented "outside
 * band / unprotected" view instead of the misleading "top 3 by margin".
 * Data source: tradeMarginSummary.outsideBand (sidecar fn merged in by the
 * BE service). The component still renders when only the legacy keys are
 * present (graceful degradation for older BE deploys).
 *
 * Patterns:
 *   - C13: semantic tokens only; no raw hex
 *   - C14: TanStack Router Link for internal nav
 *   - T3:  all strings via t() with defaultValue
 *   - D7:  scope="col" on table headers
 */
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, ChevronRight, HelpCircle, ShieldCheck, TrendingUp } from 'lucide-react';
// mig 593 — Tooltip on "Margin impact" so viewers understand it's forward-
// only exposure, not a deduction from the realised "Current margin" column.
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  TradeMarginSummary,
  TradeMarginSummaryOutsideBandRow,
} from '@/types/entities/trade-margin.types';

// ─────────────────────────────────────────────────────────────
// AED compact formatter
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

function bandStatusLabel(
  s: TradeMarginSummaryOutsideBandRow['bandStatus'],
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (s) {
    case 'above_ceiling':
      return t('financial.tradeMargin.bandStatus.aboveCeiling', { defaultValue: 'Above Ceiling' });
    case 'below_floor':
      return t('financial.tradeMargin.bandStatus.belowFloor', { defaultValue: 'Below Floor' });
    case 'no_band':
      return t('financial.tradeMargin.bandStatus.noBand', { defaultValue: 'No Band' });
  }
}

interface Props {
  tradeMarginSummary: TradeMarginSummary | null | undefined;
}

export function ExecutiveTradeMarginSection({ tradeMarginSummary }: Props) {
  const { t } = useTranslation();

  if (!tradeMarginSummary) return null;
  if (tradeMarginSummary.openPositionCount === 0) return null;

  const { bySide, outsideBand } = tradeMarginSummary;
  const sellPositionCount = bySide.sell.positionCount;
  const sellMarginAed = bySide.sell.marginAed;

  const outsideCount = outsideBand?.count ?? 0;
  const marginAtRiskAed = outsideBand?.marginAtRiskAed ?? '0';
  const needsAmendmentCount = outsideBand?.needsAmendmentCount ?? 0;
  const flaggedContracts = outsideBand?.contracts ?? [];
  const hasRisk = outsideCount > 0;

  return (
    <section
      aria-label={t('financial.tradeMargin.executive.sectionLabel')}
      className="rounded-lg border border-border bg-card p-4"
    >
      {/* Section header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gold" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-ink">
            {t('financial.tradeMargin.executive.title', {
              defaultValue: 'Index-Linked Contracts',
            })}
          </h3>
        </div>
        <Link
          to="/app/financial/trade-margin"
          className="inline-flex items-center gap-1 rounded text-xs text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t('financial.tradeMargin.executive.viewAllAriaLabel')}
        >
          {t('financial.tradeMargin.executive.viewAll')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* KPI strip — Open / Total / Margin at risk / Outside band.
          mig 592: replaces the "Benchmark context" + the fake "0 at-risk"
          tiles with the real action-oriented numbers. */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.executive.openSellPositions', {
              defaultValue: 'Open contracts',
            })}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {sellPositionCount}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.executive.totalSellMarginAed', {
              defaultValue: 'Total margin (AED)',
            })}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gold">
            {formatAedCompact(sellMarginAed)}
          </p>
        </div>
        <div
          className={
            'rounded-lg border p-3 ' +
            (hasRisk
              ? 'border-terracotta/30 bg-terracotta/5'
              : 'border-sage/30 bg-sage/5')
          }
        >
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.executive.marginAtRisk', {
              defaultValue: 'Margin at risk',
            })}
          </p>
          <p
            className={
              'mt-1 text-xl font-semibold tabular-nums ' +
              (hasRisk ? 'text-terracotta' : 'text-sage-ink')
            }
          >
            {formatAedCompact(marginAtRiskAed)}
          </p>
          <p className="text-[10px] text-ink-subtle">
            {hasRisk
              ? t('financial.tradeMargin.executive.atOspContext', {
                  defaultValue: `At ${outsideBand?.benchmarkPriceUsd ? '$' + outsideBand.benchmarkPriceUsd + '/bbl' : 'current benchmark'}`,
                  price: outsideBand?.benchmarkPriceUsd ?? '—',
                })
              : t('financial.tradeMargin.executive.protectedHelper', {
                  defaultValue: 'All positions within band',
                })}
          </p>
        </div>
        <div
          className={
            'rounded-lg border p-3 ' +
            (hasRisk
              ? 'border-terracotta/30 bg-terracotta/5'
              : 'border-sage/30 bg-sage/5')
          }
        >
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.executive.outsideBandTile', {
              defaultValue: 'Outside band / unprotected',
            })}
          </p>
          <p
            className={
              'mt-1 text-xl font-semibold tabular-nums ' +
              (hasRisk ? 'text-terracotta' : 'text-sage-ink')
            }
          >
            {outsideCount}
          </p>
          <p className="text-[10px] text-ink-subtle">
            {needsAmendmentCount > 0
              ? t('financial.tradeMargin.executive.needsAmendmentHelper', {
                  defaultValue: `${needsAmendmentCount} need contract amendment`,
                  count: needsAmendmentCount,
                })
              : hasRisk
                ? t('financial.tradeMargin.executive.escalateHelper', {
                    defaultValue: 'Escalate via Index-Linked',
                  })
                : t('financial.tradeMargin.executive.allProtected', {
                    defaultValue: 'All within band',
                  })}
          </p>
        </div>
      </div>

      {/* Demo-gap fix 2026-06-08 — benchmark caption removed.
          Was rendering "MURBAN OSP at $103/bbl as of 2026-12-01" — the
          asOf date is months out from today's demo clock, which read as
          stale to the audience. Headline KPIs + the per-row contracts
          list below already convey the same story. */}

      {/* Outside-band contracts list (or empty state).
          Layout mirrors ExecutiveBudgetBurnSection's "Top projected overruns":
            - Header: inline icon + uppercase tracking-wider label
            - Each row: rounded-md card with tinted border + bg, contract
              number + secondary line, AED pill, caption, chevron link
          Visual consistency with Contract Spend Health (E-rev-Q). */}
      {hasRisk && flaggedContracts.length > 0 ? (
        <div>
          <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {t('financial.tradeMargin.executive.outsideBandListTitle', {
              defaultValue: 'Outside band or unprotected',
            })}
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('financial.tradeMargin.executive.marginImpactTooltipAria', {
                      defaultValue: 'How is margin impact calculated?',
                    })}
                    className="ms-0.5 text-ink-subtle hover:text-ink"
                  >
                    <HelpCircle className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px] text-xs leading-relaxed">
                  {t('financial.tradeMargin.executive.marginImpactTooltip', {
                    defaultValue:
                      'Forward-only exposure if the buyer invokes the price-review clause. Per-position: (benchmark OSP − contracted ceiling) × volume × USD→AED rate. The "Current margin" earned on already-lifted barrels is not affected.',
                  })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
          <div className="space-y-2">
            {flaggedContracts.map((row) => {
              const impact = parseFloat(row.marginImpactAed);
              const isNoBand = row.bandStatus === 'no_band';
              // no_band has no current impact but flags an amendment need —
              // use the amber palette to differentiate from the breach
              // cases (terracotta).
              const cardCls = isNoBand
                ? 'border-amber-ink/30 bg-amber-tint/30'
                : 'border-terracotta/30 bg-terracotta/5';
              const pillCls = isNoBand
                ? 'bg-amber-tint/70 text-amber-ink'
                : 'bg-terracotta/15 text-terracotta';
              const linkHoverCls = isNoBand
                ? 'hover:text-amber-ink'
                : 'hover:text-terracotta';
              return (
                <div
                  key={row.tradePositionId}
                  className={`flex items-center justify-between gap-3 rounded-md border ${cardCls} px-3 py-2`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {row.positionRef}
                    </p>
                    <p className="truncate text-[11px] text-ink-muted">
                      {row.counterpartyName}
                      <span className="text-ink-subtle">
                        {' '}· {bandStatusLabel(row.bandStatus, t)}
                        {!row.hasClause && (
                          <>
                            {' '}· {t('financial.tradeMargin.executive.needsClause', {
                              defaultValue: 'needs amendment',
                            })}
                          </>
                        )}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex items-center rounded-md ${pillCls} px-2 py-0.5 font-mono text-xs font-semibold`}
                    >
                      {isNoBand || impact <= 0
                        ? t('financial.tradeMargin.executive.amendmentPillLabel', {
                            defaultValue: 'No clause',
                          })
                        : formatAedCompact(row.marginImpactAed)}
                    </span>
                    <p className="mt-0.5 text-[11px] tabular-nums text-ink-subtle">
                      {row.thresholdLabel}
                    </p>
                  </div>
                  <Link
                    to="/app/financial/trade-margin/$positionId"
                    params={{ positionId: String(row.tradePositionId) }}
                    className={`shrink-0 rounded p-1 text-ink-muted ${linkHoverCls} focus:outline-none focus:ring-2 focus:ring-primary`}
                    aria-label={t(
                      'financial.tradeMargin.executive.viewPositionAriaLabel',
                      { ref: row.positionRef },
                    )}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-sage/20 bg-sage/5 px-3 py-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
          <p className="text-xs text-sage">
            {t('financial.tradeMargin.executive.emptyStateProtected', {
              defaultValue: `All ${sellPositionCount} contracts within protection band${outsideBand?.benchmarkPriceUsd ? ` at $${outsideBand.benchmarkPriceUsd}/bbl` : ''}.`,
              count: sellPositionCount,
            })}
          </p>
        </div>
      )}
    </section>
  );
}
