/**
 * ExecutiveTradeMarginSection — CR-O M21 Financial Intelligence (Trade Margin).
 *
 * Additive "Trade Margin" rollup section for the Executive Dashboard.
 * Consumes the `tradeMarginSummary` key (11th top-level key added to
 * fn_dashboard_executive output by CR-O DB migration).
 *
 * Pattern mirrors ExecutiveBudgetBurnSection (CR-N):
 *   - Receives data as prop (caller casts the intersection type)
 *   - Renders nothing (null) when data is absent or openPositionCount === 0
 *     (defensive: no trade data yet — MUST NOT break executive dashboard)
 *   - C13: no raw hex — semantic tokens only
 *   - T3:  all strings via t()
 *   - C14: Router Link for internal nav
 *   - D7:  scope="col" on <th> (topPositionsByMargin3 table)
 * AC#7: tradeMarginSummary rollup + all prior executive keys preserved.
 */
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { TrendingDown, TrendingUp, ChevronRight, Minus } from 'lucide-react';
import type { TradeMarginSummary } from '@/types/entities/trade-margin.types';
// E14 fix — humanize benchmarkCode display.
import { humanizeLabel } from './dashboard-primitives';

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
  tradeMarginSummary: TradeMarginSummary | null | undefined;
}

export function ExecutiveTradeMarginSection({
  tradeMarginSummary,
}: Props) {
  const { t } = useTranslation();

  // Defensive: render nothing when key absent (pre-migration or no trade data).
  // MUST NOT crash the executive dashboard.
  if (!tradeMarginSummary) return null;
  if (tradeMarginSummary.openPositionCount === 0) return null;

  const {
    bySide,
    recentMarginChange,
    topPositionsByMargin3,
  } = tradeMarginSummary;

  // E-rev-H — Story 5a is sell-side only. Use bySide.sell as the source of
  // truth for the tile; drop the buy column and the buy KPI.
  const sellPositionCount = bySide.sell.positionCount;
  const sellMarginAed = bySide.sell.marginAed;

  const hasCompression =
    recentMarginChange && parseFloat(recentMarginChange.deltaAed) < 0;
  // Filter top positions to sell-side rows only.
  const sellTopPositions = topPositionsByMargin3.filter((r) => r.side === 'sell');

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
            {t('financial.tradeMargin.executive.title')}
          </h3>
        </div>
        {/* C14: Router Link */}
        <Link
          to="/app/financial/trade-margin"
          className="inline-flex items-center gap-1 rounded text-xs text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t('financial.tradeMargin.executive.viewAllAriaLabel')}
        >
          {t('financial.tradeMargin.executive.viewAll')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* E-rev-H — Sell-side KPI strip. Buy tile dropped; new tile tracks
          the Murban OSP context that drives the demo narrative. */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.executive.openSellPositions', {
              defaultValue: 'Open sell positions',
            })}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {sellPositionCount}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.executive.totalSellMarginAed', {
              defaultValue: 'Total sell margin (AED)',
            })}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gold">
            {formatAedCompact(sellMarginAed)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.executive.murbanOspContext', {
              defaultValue: 'Murban OSP context',
            })}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {recentMarginChange?.benchmarkCode === 'murban_osp'
              ? formatAedCompact(recentMarginChange.deltaAed)
              : '—'}
          </p>
          <p className="text-[10px] text-ink-subtle">
            {t('financial.tradeMargin.executive.deltaLast7d', {
              defaultValue: 'Margin Δ from last move',
            })}
          </p>
        </div>
        <div
          className={
            'rounded-lg border p-3 ' +
            (hasCompression
              ? 'border-terracotta/30 bg-terracotta/5'
              : 'border-sage/30 bg-sage/5')
          }
        >
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.executive.exposedPositions', {
              defaultValue: 'At-risk positions',
            })}
          </p>
          <p
            className={
              'mt-1 text-xl font-semibold tabular-nums ' +
              (hasCompression ? 'text-terracotta' : 'text-sage-ink')
            }
          >
            {hasCompression ? sellTopPositions.length : 0}
          </p>
          <p className="text-[10px] text-ink-subtle">
            {hasCompression
              ? t('financial.tradeMargin.executive.escalateHelper', {
                  defaultValue: 'Escalate via Trade Margin',
                })
              : t('financial.tradeMargin.executive.allProtected', {
                  defaultValue: 'All within band',
                })}
          </p>
        </div>
      </div>

      {/* Recent margin change alert (OSP-drop compression) */}
      {/* E14 fix: humanize benchmarkCode ("murban_osp" → "Murban OSP")
          and show a "stable" message instead of "AED 0" when delta is zero. */}
      {recentMarginChange && (() => {
        const deltaAedNum = parseFloat(recentMarginChange.deltaAed);
        const benchmarkLabel = humanizeLabel(recentMarginChange.benchmarkCode);
        const isStable = Math.abs(deltaAedNum) < 100_000; // < AED 100k is effectively no movement
        return (
          <div
            className={`mb-4 flex items-center gap-2 rounded-md border px-3 py-2 ${
              isStable
                ? 'border-sage/30 bg-sage/5'
                : hasCompression
                  ? 'border-terracotta/30 bg-terracotta/5'
                  : 'border-success/30 bg-success/5'
            }`}
          >
            {isStable ? (
              <Minus className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
            ) : hasCompression ? (
              <TrendingDown className="h-4 w-4 shrink-0 text-terracotta" aria-hidden="true" />
            ) : (
              <TrendingUp className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            )}
            <p
              className={`text-xs ${
                isStable
                  ? 'text-sage'
                  : hasCompression
                    ? 'text-terracotta'
                    : 'text-success'
              }`}
            >
              {isStable
                ? t('financial.tradeMargin.executive.recentChangeStable', {
                    defaultValue: `${benchmarkLabel} stable — no significant movement in the last 7 days`,
                    benchmarkLabel,
                  })
                : t('financial.tradeMargin.executive.recentChange', {
                    benchmarkCode: benchmarkLabel,
                    delta: formatAedCompact(recentMarginChange.deltaAed),
                    asOf: recentMarginChange.asOf,
                  })}
            </p>
          </div>
        );
      })()}

      {/* Top positions by margin — sell-side only */}
      {sellTopPositions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('financial.tradeMargin.executive.topPositions')}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="sr-only">
                <tr>
                  <th scope="col">
                    {t('financial.tradeMargin.columns.position')}
                  </th>
                  <th scope="col">
                    {t('financial.tradeMargin.columns.side')}
                  </th>
                  <th scope="col">
                    {t('financial.tradeMargin.columns.counterparty')}
                  </th>
                  <th scope="col">
                    {t('financial.tradeMargin.columns.totalMarginAed')}
                  </th>
                  <th scope="col">
                    <span className="sr-only">{t('common.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sellTopPositions.map((row) => (
                  <tr
                    key={row.tradePositionId}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <td className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {row.positionRef}
                      </p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {row.counterpartyName}
                      </p>
                    </td>
                    {/* E-rev-H — Side cell removed; sell-side only. */}
                    <td className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums text-ink">
                        {formatAedCompact(row.totalMarginAed)}
                      </p>
                    </td>
                    <td>
                      {/* C14: Router Link */}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
