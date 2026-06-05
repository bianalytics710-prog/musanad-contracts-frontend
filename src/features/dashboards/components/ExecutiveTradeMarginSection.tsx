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

      {/* Benchmark status caption — keep the "why" for the executive. */}
      {outsideBand?.benchmarkCode && outsideBand.benchmarkPriceUsd && outsideBand.asOf && (
        <div
          className={
            'mb-4 flex items-center gap-2 rounded-md border px-3 py-2 ' +
            (hasRisk
              ? 'border-terracotta/30 bg-terracotta/5'
              : 'border-sage/30 bg-sage/5')
          }
        >
          {hasRisk ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-terracotta" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
          )}
          <p className={'text-xs ' + (hasRisk ? 'text-terracotta' : 'text-sage')}>
            {hasRisk
              ? t('financial.tradeMargin.executive.benchmarkCaptionRisk', {
                  defaultValue: `${outsideBand.benchmarkCode.replace(/_/g, ' ').toUpperCase()} at $${outsideBand.benchmarkPriceUsd}/bbl as of ${outsideBand.asOf} — ${outsideCount} contracts outside band`,
                })
              : t('financial.tradeMargin.executive.benchmarkCaptionSafe', {
                  defaultValue: `${outsideBand.benchmarkCode.replace(/_/g, ' ').toUpperCase()} at $${outsideBand.benchmarkPriceUsd}/bbl as of ${outsideBand.asOf} — all positions protected`,
                })}
          </p>
        </div>
      )}

      {/* Outside-band contracts list (or empty state). */}
      {hasRisk && flaggedContracts.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('financial.tradeMargin.executive.outsideBandListTitle', {
              defaultValue: 'Outside band or unprotected',
            })}
            <span className="ms-1 normal-case font-normal text-ink-subtle">
              · {t('financial.tradeMargin.executive.marginImpactCol', {
                defaultValue: 'Margin impact',
              })}
            </span>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('financial.tradeMargin.executive.marginImpactTooltipAria', {
                      defaultValue: 'How is margin impact calculated?',
                    })}
                    className="text-ink-subtle hover:text-ink"
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="sr-only">
                <tr>
                  <th scope="col">
                    {t('financial.tradeMargin.columns.position', { defaultValue: 'Position' })}
                  </th>
                  <th scope="col">
                    {t('financial.tradeMargin.columns.counterparty', { defaultValue: 'Counterparty' })}
                  </th>
                  <th scope="col">
                    {t('financial.tradeMargin.columns.bandStatus', { defaultValue: 'Band status' })}
                  </th>
                  <th scope="col">
                    {t('financial.tradeMargin.executive.marginImpactCol', {
                      defaultValue: 'Margin impact',
                    })}
                  </th>
                  <th scope="col">
                    <span className="sr-only">{t('common.actions', { defaultValue: 'Actions' })}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flaggedContracts.map((row) => {
                  const impact = parseFloat(row.marginImpactAed);
                  const isNoBand = row.bandStatus === 'no_band';
                  return (
                    <tr
                      key={row.tradePositionId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <td className="min-w-0 flex-1 basis-[40%]">
                        <p className="truncate font-medium text-ink">
                          {row.positionRef}
                        </p>
                        <p className="truncate text-[11px] text-ink-muted">
                          {row.counterpartyName}
                        </p>
                      </td>
                      <td className="shrink-0">
                        <span
                          className={
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ' +
                            (isNoBand
                              ? 'border-terracotta/40 bg-terracotta/10 text-terracotta'
                              : 'border-gold/40 bg-gold/10 text-gold')
                          }
                        >
                          {bandStatusLabel(row.bandStatus, t)}
                          {!row.hasClause && (
                            <span className="opacity-80">
                              {' '}· {t('financial.tradeMargin.executive.needsClause', {
                                defaultValue: 'needs amendment',
                              })}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="shrink-0 text-right">
                        <p
                          className={
                            'font-semibold tabular-nums ' +
                            (impact > 0 ? 'text-terracotta' : 'text-ink-muted')
                          }
                        >
                          {impact > 0 ? formatAedCompact(row.marginImpactAed) : '—'}
                        </p>
                        <p className="text-[10px] text-ink-subtle">
                          {row.thresholdLabel}
                        </p>
                      </td>
                      <td>
                        <Link
                          to="/app/financial/trade-margin/$positionId"
                          params={{ positionId: String(row.tradePositionId) }}
                          className="shrink-0 rounded p-1 text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                          aria-label={t(
                            'financial.tradeMargin.executive.viewPositionAriaLabel',
                            { ref: row.positionRef },
                          )}
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
