/**
 * /app/financial/budget-burn — Portfolio list (index).
 *
 * CR-N — M21 Financial Intelligence. Primary persona: finance_treasury.
 * CR-R — Portfolio horizontal-bar chart + virtualized table + search + 3 filter chips.
 *
 * Additions vs CR-N:
 *   - Chart #5: horizontal-bar consumption chart (recharts BarChart layout="vertical")
 *     sorted by variancePct DESC, colored by status
 *   - Search input with useDebounce(300)
 *   - 3 filter chips: "Over budget only" / "By subsidiary" / "By emirate"
 *   - Table body virtualized via @tanstack/react-virtual (useVirtualizer)
 *   - Pagination removed — virtualization handles scroll
 *
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
 *   T10: useDebounce(300) on search
 *   T11: ErrorBoundary at route level
 *   T12: formatDateTime for timestamps
 */
import { useState, useMemo, useRef } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  RefreshCcw,
  ChevronRight,
  TrendingUp,
  Search,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { ChartCard, SemanticTooltip } from '@/components/charts';
// Shared split-table alignment utility — keeps the sticky header and
// virtualized body in lockstep column-for-column.
import { ScrollbarReservedHeader, PercentColgroup } from '@/components/patterns';

// Column widths used by BOTH the head table and every per-row body table.
// 8 columns, must sum to 100.
const BUDGET_BURN_COL_WIDTHS = [24, 13, 10, 10, 9, 12, 12, 10] as const;
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { financialBudgetBurnService } from '@/services/api/financial-budget-burn.service';
import { translateApiError } from '@/lib/translate-api-error';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import type {
  PortfolioContractRow,
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

// ─────────────────────────────────────────────────────────────
// ADNOC subsidiary names (static list for the filter chip)
// ─────────────────────────────────────────────────────────────
const ADNOC_SUBSIDIARIES = [
  'Onshore',
  'Offshore',
  'Drilling',
  'Gas',
  'L&S',
  'Distribution',
  'Trading',
  'AGT',
] as const;

// ─────────────────────────────────────────────────────────────
// Chart color helpers (semantic tokens)
// ─────────────────────────────────────────────────────────────
function barFill(pctConsumed: number): string {
  if (pctConsumed >= 100) return 'var(--terracotta)';
  if (pctConsumed >= 80) return 'var(--amber)';
  return 'var(--sage)';
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────
function BudgetBurnPortfolioView() {
  const { t } = useTranslation();
  const canRead = useAuthStore(selectHasPermission('finance.budget.read'));

  // Fetch all rows (no pagination — virtualizer handles scroll)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['budget-burn-portfolio-all'],
    queryFn: () => financialBudgetBurnService.getPortfolio({ limit: 100 }),
    enabled: canRead,
    staleTime: 30_000,
  });

  const allRows: PortfolioContractRow[] = data?.data ?? [];
  const summary = data?.summary;

  // ── Search + filter state ──────────────────────────────────
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [overBudgetOnly, setOverBudgetOnly] = useState(false);
  const [selectedSubsidiary, setSelectedSubsidiary] = useState('');
  const [selectedEmirate, setSelectedEmirate] = useState('');
  const [showSubsidiaryPicker, setShowSubsidiaryPicker] = useState(false);
  const [showEmiratePicker, setShowEmiratePicker] = useState(false);

  // ── Sort: variancePct DESC so breaches surface first ───────
  const sortedRows = useMemo(
    () =>
      [...allRows].sort((a, b) => (b.variancePct ?? 0) - (a.variancePct ?? 0)),
    [allRows],
  );

  // ── Derive emirate list from counterpartyName (substring match) ──
  // Emirates from data: parse from counterpartyName if they include known emirate strings.
  const emirateOptions = useMemo(() => {
    const UAE_EMIRATES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Fujairah', 'Ras Al Khaimah', 'Umm Al Quwain'];
    const found = new Set<string>();
    for (const row of sortedRows) {
      const name = (row.counterpartyName ?? '').toLowerCase();
      for (const em of UAE_EMIRATES) {
        if (name.includes(em.toLowerCase())) {
          found.add(em);
        }
      }
    }
    // Always include Abu Dhabi and Dubai if we have rows (ADNOC reality is ~75% AD)
    if (sortedRows.length > 0) {
      found.add('Abu Dhabi');
      found.add('Dubai');
    }
    return Array.from(found).sort();
  }, [sortedRows]);

  // ── Apply filters ─────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = sortedRows;

    // Search
    if (search) {
      const lower = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.contractNumber.toLowerCase().includes(lower) ||
          r.titleEn.toLowerCase().includes(lower) ||
          (r.counterpartyName ?? '').toLowerCase().includes(lower),
      );
    }

    // "Over budget only" filter — broaden to include contracts trending
    // toward overrun (projected > 0) so the chip surfaces the demo
    // narrative (HERO-001 etc.), not just contracts already breached today.
    if (overBudgetOnly) {
      rows = rows.filter(
        (r) =>
          r.varianceFlag ||
          r.pctConsumed >= 100 ||
          parseFloat(r.projectedOverUnderAed) > 0,
      );
    }

    // By subsidiary (substring of counterpartyName or title)
    if (selectedSubsidiary) {
      const sub = selectedSubsidiary.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.counterpartyName ?? '').toLowerCase().includes(sub) ||
          r.titleEn.toLowerCase().includes(sub),
      );
    }

    // By emirate
    if (selectedEmirate) {
      const em = selectedEmirate.toLowerCase();
      rows = rows.filter(
        (r) => (r.counterpartyName ?? '').toLowerCase().includes(em),
      );
    }

    return rows;
  }, [sortedRows, search, overBudgetOnly, selectedSubsidiary, selectedEmirate]);

  // ── Chart #5 data: top 15 by pctConsumed descending ───────
  // E-rev-F-3 / E-rev-G-2 — Each row carries actual + projected segments
  // plus the AED amounts so the custom tooltip can show real money.
  const chartRows = useMemo(
    () =>
      [...sortedRows]
        .sort((a, b) => b.pctConsumed - a.pctConsumed)
        .slice(0, 15)
        .map((r) => {
          const actualPct = typeof r.pctConsumed === 'number' ? r.pctConsumed : 0;
          const budget = parseFloat(r.budgetAed ?? '0');
          const projectedOverUnder = parseFloat(r.projectedOverUnderAed ?? '0');
          const projectedPct =
            budget > 0 ? ((budget + projectedOverUnder) / budget) * 100 : actualPct;
          const projectedDelta = Math.max(0, projectedPct - actualPct);
          return {
            contractNumber: r.contractNumber,
            actualPct,
            projectedDelta,
            projectedPct,
            actualAed: r.actualAed,
            budgetAed: r.budgetAed,
            projectedOverUnderAed: r.projectedOverUnderAed,
            isOver: r.varianceFlag || actualPct >= 100,
          };
        }),
    [sortedRows],
  );

  // ── Virtualization ─────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
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
      {/* Header + search */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('financial.budgetBurn.portfolio.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('financial.budgetBurn.portfolio.subtitle')}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            type="search"
            id="portfolio-search"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder={t('budgetBurn.portfolio.filters.searchPlaceholder')}
            className="h-9 rounded-md border border-border bg-card ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            aria-label={t('budgetBurn.portfolio.filters.searchPlaceholder')}
          />
          {searchRaw && (
            <button
              type="button"
              onClick={() => setSearchRaw('')}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              aria-label={t('common.clearSearch', { defaultValue: 'Clear search' })}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* E-rev-G-3 — Three top filter chips (Over budget / Subsidiary /
          Emirate) removed; the dataset is small enough that search +
          the at-a-glance Status pills carry the load. Filter state is
          kept untouched in the parent for backwards-compat — values are
          just always default (no UI for them). */}
      {search && (
        <div className="text-xs text-ink-muted">
          {t('budgetBurn.portfolio.filters.showing', {
            count: filteredRows.length,
            total: sortedRows.length,
            defaultValue: '{{count}} of {{total}} contracts',
          })}
        </div>
      )}

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

      {!isLoading && !isError && (
        <>
          {/* Portfolio summary strip */}
          {summary && (
            <>
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
                {/* E-rev-F-2 — Variance signing: negative variance means we
                    spent LESS than budget (favourable) → render sage/green
                    via the "success" variant. Positive variance is overrun
                    → "risk" terracotta. Caption below clarifies the sign. */}
                <SummaryTile
                  label={t('financial.budgetBurn.portfolio.summary.totalVariance', {
                    defaultValue: 'Total variance',
                  })}
                  value={formatAed(summary.totalVarianceAed)}
                  variant={
                    parseFloat(summary.totalVarianceAed) > 0
                      ? 'risk'
                      : parseFloat(summary.totalVarianceAed) < 0
                        ? 'success'
                        : 'default'
                  }
                  helper={t('financial.budgetBurn.portfolio.summary.totalVarianceHelper', {
                    defaultValue: 'Negative = under budget',
                  })}
                />
                {/* E-rev-F-1 — fixed 5th-tile broken i18n key. Was passing a
                    raw JS expression as the key; now reads a proper label +
                    the actual count value. */}
                <SummaryTile
                  label={t('financial.budgetBurn.portfolio.summary.overBudgetCount', {
                    defaultValue: 'Over budget',
                  })}
                  value={String((summary.overBudgetContractCount ?? summary.overBudgetCount ?? 0))}
                  variant={(summary.overBudgetContractCount ?? summary.overBudgetCount ?? 0) > 0 ? 'warning' : 'default'}
                />
                <SummaryTile
                  label={t('financial.budgetBurn.portfolio.summary.totalProjectedOverrun', {
                    defaultValue: 'Projected overrun',
                  })}
                  value={formatAed(summary.totalProjectedOverrunAed)}
                  variant={parseFloat(summary.totalProjectedOverrunAed) > 0 ? 'risk' : 'default'}
                />
              </section>
              {/* E37 fix — surface the year-end projection narrative on the
                  portfolio page so the demo story (HERO-001 trending toward
                  breach) is visible even when today's overBudgetCount === 0. */}
              {(summary.overBudgetContractCount ?? summary.overBudgetCount ?? 0) === 0 && summary.contractsWithBudget > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-ink">
                  {t('financial.budgetBurn.portfolio.zeroOverButCheckTrend', {
                    defaultValue:
                      'All {{count}} contracts are within budget today. Open each contract\'s Projection tab to review year-end run-rate — variance trends may signal future breaches.',
                    count: summary.contractsWithBudget,
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Chart #5: Portfolio consumption horizontal bar ──── */}
          {/* E39 fix — clarify subtitle that this chart shows the TOP-N
              by consumption, not the entire portfolio, so executives
              don't wonder "where are the other contracts?". */}
          {chartRows.length > 0 && (
            <ChartCard
              title={t('budgetBurn.charts.portfolioConsumption.title')}
              subtitle={
                summary && summary.contractsWithBudget > chartRows.length
                  ? t('budgetBurn.charts.portfolioConsumption.subtitleTopN', {
                      defaultValue: 'Top {{shown}} by consumption (of {{total}} total) — full list below',
                      shown: chartRows.length,
                      total: summary.contractsWithBudget,
                    })
                  : t('budgetBurn.charts.portfolioConsumption.subtitle')
              }
              height={280}
              empty={chartRows.length === 0}
              emptyLabel={t('common.charts.empty')}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  layout="vertical"
                  margin={{ top: 4, right: 32, bottom: 4, left: 12 }}
                >
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} opacity={0.3} />
                  <XAxis
                    type="number"
                    fontSize={10}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    domain={[0, 'auto']}
                    ticks={[0, 25, 50, 75, 100, 125, 150]}
                  />
                  {/* E-rev-G-1 — Widen YAxis from 100 → 140 so longer contract
                      numbers (e.g. "CRN-296-HERO-001") stop getting truncated
                      on the start edge. */}
                  <YAxis
                    dataKey="contractNumber"
                    type="category"
                    width={140}
                    fontSize={10}
                    tick={{ fill: 'var(--ink-muted)' }}
                  />
                  {/* E-rev-G-2 / fix — Custom tooltip showing AED amounts.
                      Using Recharts <Tooltip> directly (not SemanticTooltip)
                      because the wrapper's contentStyle / defaultFormatter
                      were overriding the custom render. */}
                  <RechartsTooltip
                    cursor={{ fill: 'var(--surface)', opacity: 0.4 }}
                    wrapperStyle={{ outline: 'none' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as typeof chartRows[number] | undefined;
                      if (!row) return null;
                      const overrun = parseFloat(row.projectedOverUnderAed ?? '0');
                      return (
                        <div className="rounded-md border border-border bg-card p-2 shadow-md">
                          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                            {row.contractNumber}
                          </p>
                          <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
                            <span className="text-ink-muted">{t('budgetBurn.charts.portfolioConsumption.tooltipActual', { defaultValue: 'Actual' })}</span>
                            <span className="text-end font-mono text-ink">{formatAed(row.actualAed)}</span>
                            <span className="text-ink-muted">{t('budgetBurn.charts.portfolioConsumption.tooltipBudget', { defaultValue: 'Budget' })}</span>
                            <span className="text-end font-mono text-ink">{formatAed(row.budgetAed)}</span>
                            <span className="text-ink-muted">{t('budgetBurn.charts.portfolioConsumption.tooltipConsumed', { defaultValue: 'Consumed' })}</span>
                            <span className="text-end font-mono text-ink">{row.actualPct.toFixed(1)}%</span>
                            <span className="text-ink-muted">{t('budgetBurn.charts.portfolioConsumption.tooltipProjected', { defaultValue: 'Projected year-end' })}</span>
                            <span className="text-end font-mono text-ink">{row.projectedPct.toFixed(1)}%</span>
                            <span className="text-ink-muted">{t('budgetBurn.charts.portfolioConsumption.tooltipOverrun', { defaultValue: 'Projected over/under' })}</span>
                            <span
                              className={
                                'text-end font-mono ' +
                                (overrun > 0 ? 'text-terracotta' : 'text-sage-ink')
                              }
                            >
                              {overrun > 0 ? '+' : ''}{formatAed(row.projectedOverUnderAed)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {/* Segment 1 — actual % consumed (solid sage/amber/terracotta) */}
                  <Bar dataKey="actualPct" stackId="usage">
                    {chartRows.map((entry, index) => (
                      <Cell key={`actual-${index}`} fill={barFill(entry.actualPct)} />
                    ))}
                  </Bar>
                  {/* Segment 2 — E-rev-G-2: projected addt’l now renders as an
                      outlined dashed box (no fill) so the 100% line below is
                      always visible cutting through it. Terra outline when the
                      projection crosses 100%, sage otherwise. */}
                  <Bar dataKey="projectedDelta" stackId="usage" radius={[0, 3, 3, 0]} strokeDasharray="3 3" strokeWidth={1.5}>
                    {chartRows.map((entry, index) => (
                      <Cell
                        key={`proj-${index}`}
                        fill="transparent"
                        stroke={entry.projectedPct >= 100 ? 'var(--terracotta)' : 'var(--sage)'}
                      />
                    ))}
                  </Bar>
                  {/* E-rev-G-2 — 100% budget breach line declared AFTER the
                      Bars so it renders on top, fully visible. Solid stroke
                      (was dashed) so it reads as the ground-truth limit. */}
                  <ReferenceLine
                    x={100}
                    stroke="var(--terracotta)"
                    strokeWidth={1.5}
                    ifOverflow="extendDomain"
                    label={{
                      value: t('budgetBurn.charts.portfolioConsumption.budgetLine', {
                        defaultValue: 'Budget = 100%',
                      }),
                      position: 'top',
                      fontSize: 10,
                      fill: 'var(--terracotta)',
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* ── Virtualized table ────────────────────────────────── */}
          {filteredRows.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card">
              <TrendingUp className="h-8 w-8 text-ink-subtle" aria-hidden="true" />
              <p className="text-sm font-medium text-ink">
                {search || overBudgetOnly || selectedSubsidiary || selectedEmirate
                  ? t('budgetBurn.portfolio.filters.noResults', { defaultValue: 'No contracts match the current filters.' })
                  : t('financial.budgetBurn.portfolio.empty.title')}
              </p>
              <p className="text-xs text-ink-muted">
                {!(search || overBudgetOnly || selectedSubsidiary || selectedEmirate) &&
                  t('financial.budgetBurn.portfolio.empty.body')}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border shadow-sm">
              {/* Column widths shared by head + body tables — see
                  components/patterns/FixedColumnsTable.tsx for the why. */}
              <ScrollbarReservedHeader>
              <table className="w-full table-fixed text-sm">
                <PercentColgroup widths={BUDGET_BURN_COL_WIDTHS} />
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('financial.budgetBurn.columns.contract')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('financial.budgetBurn.columns.counterparty')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-subtle tabular-nums">
                      {t('financial.budgetBurn.columns.budget')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-subtle tabular-nums">
                      {t('financial.budgetBurn.columns.actual')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-subtle tabular-nums">
                      {t('financial.budgetBurn.columns.consumed')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-subtle tabular-nums">
                      {t('financial.budgetBurn.columns.projectedOverUnder')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('financial.budgetBurn.columns.status')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('common.action', { defaultValue: 'Action' })}
                    </th>
                  </tr>
                </thead>
              </table>
              </ScrollbarReservedHeader>

              {/* Virtualized table body. overflow-y is 'scroll' (not 'auto')
                  so the scrollbar is always present — keeps body width in
                  exact lockstep with head width, even when content is short. */}
              <div
                ref={parentRef}
                className="h-[600px] overflow-y-scroll"
              >
                <div
                  style={{
                    height: virtualizer.getTotalSize(),
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = filteredRows[virtualRow.index];
                    if (!row) return null;
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <table className="w-full table-fixed text-sm">
                          {/* Same widths as head — see BUDGET_BURN_COL_WIDTHS const above. */}
                          <PercentColgroup widths={BUDGET_BURN_COL_WIDTHS} />
                          <tbody>
                            <PortfolioRow row={row} />
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row count footer */}
              <div className="border-t border-border px-4 py-2 text-xs text-ink-muted">
                {t('budgetBurn.portfolio.filters.showing', {
                  count: filteredRows.length,
                  total: sortedRows.length,
                  defaultValue: '{{count}} of {{total}} contracts',
                })}
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
  helper,
}: {
  label: string;
  value: string;
  // E-rev-F-2: added 'success' (sage/green) so negative variance — which
  // means we're under budget — reads as favourable, not as a deficit.
  variant?: 'default' | 'warning' | 'risk' | 'success';
  helper?: string;
}) {
  const containerClass =
    variant === 'risk'
      ? 'border-terracotta/30 bg-terracotta/5'
      : variant === 'warning'
        ? 'border-warning/30 bg-warning/5'
        : variant === 'success'
          ? 'border-sage/30 bg-sage/5'
          : 'border-border bg-card';

  const valueClass =
    variant === 'risk'
      ? 'text-terracotta'
      : variant === 'warning'
        ? 'text-warning'
        : variant === 'success'
          ? 'text-sage-ink'
          : 'text-ink';

  return (
    <div className={`rounded-lg border p-4 ${containerClass}`}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
      {helper && <p className="mt-1 text-[10px] text-ink-subtle">{helper}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PortfolioRow — single contract row
// ─────────────────────────────────────────────────────────────
function PortfolioRow({ row }: { row: PortfolioContractRow }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const projectedAed = parseFloat(row.projectedOverUnderAed);
  const projectedClass = projectedAed > 0 ? 'text-terracotta' : 'text-success';

  // E13/E37 follow-up: status badge must reflect THREE states, not two.
  // The original `varianceFlag` only marks contracts where actual > budget
  // today, missing the entire demo narrative (HERO-001 has +AED 105.7M
  // projected overrun but actuals haven't exceeded budget yet). Three states:
  //   1. Over budget   — actual already > budget today          (terracotta)
  //   2. Trending over — projected year-end overrun > 0          (warning)
  //   3. On track      — neither                                 (success)
  const isOverToday = row.varianceFlag || row.pctConsumed >= 100;
  const isTrendingOver = !isOverToday && projectedAed > 0;

  return (
    // E12-table fix: column widths now live on shared <colgroup> in both
    // head and body tables (see file's main render), so per-td widths are
    // intentionally OMITTED here — colgroup is authoritative.
    <tr className="border-b border-border transition-colors hover:bg-surface/50 last:border-0">
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{row.contractNumber}</p>
        {/* E12-bilingual fix: only show AR title when actor language is AR.
            In EN mode showing both is noise and clutters the row. */}
        <p className="text-xs text-ink-muted">{isAr && row.titleAr ? row.titleAr : row.titleEn}</p>
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
        {/* E-rev-F-4 — Status pills now use the solid-tint + dark-ink-text
            convention from Impact Watch SEVERITY_TONE / Risk Cases badges
            (sage / amber / terracotta tokens). Drops the borders + translucent
            backgrounds for a cleaner, design-system-consistent look. */}
        {isOverToday ? (
          <span className="inline-flex items-center rounded-full bg-terracotta-tint px-2 py-0.5 text-[10px] font-medium text-terracotta-ink">
            {t('financial.budgetBurn.varianceFlag.over')}
          </span>
        ) : isTrendingOver ? (
          <span
            className="inline-flex items-center rounded-full bg-amber-tint/60 px-2 py-0.5 text-[10px] font-medium text-amber-ink"
            title={t('financial.budgetBurn.varianceFlag.trendingOverTitle', {
              defaultValue:
                'Within budget today but projected year-end overrun > 0 based on current run-rate.',
            })}
          >
            {t('financial.budgetBurn.varianceFlag.trendingOver', { defaultValue: 'Trending over' })}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-sage-tint px-2 py-0.5 text-[10px] font-medium text-sage-ink">
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
      <td className="px-4 py-3 text-right">
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
