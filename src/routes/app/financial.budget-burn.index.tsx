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
  ResponsiveContainer,
} from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { ChartCard, SemanticTooltip } from '@/components/charts';
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

    // Over budget only
    if (overBudgetOnly) {
      rows = rows.filter(
        (r) => r.varianceFlag || r.pctConsumed >= 100,
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
  const chartRows = useMemo(
    () =>
      [...sortedRows]
        .sort((a, b) => b.pctConsumed - a.pctConsumed)
        .slice(0, 15)
        .map((r) => ({
          contractNumber: r.contractNumber,
          pctConsumed: typeof r.pctConsumed === 'number' ? r.pctConsumed : 0,
          isOver: r.varianceFlag || r.pctConsumed >= 100,
        })),
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

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Over budget only */}
        <button
          type="button"
          onClick={() => setOverBudgetOnly((v) => !v)}
          aria-pressed={overBudgetOnly}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition',
            overBudgetOnly
              ? 'border-terracotta bg-terracotta/10 text-terracotta'
              : 'border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink',
          )}
        >
          {t('budgetBurn.portfolio.filters.overBudgetOnly')}
        </button>

        {/* By subsidiary */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowSubsidiaryPicker((v) => !v);
              setShowEmiratePicker(false);
            }}
            aria-haspopup="listbox"
            aria-expanded={showSubsidiaryPicker}
            className={cn(
              'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
              selectedSubsidiary
                ? 'border-gold bg-gold/10 text-ink'
                : 'border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink',
            )}
          >
            {selectedSubsidiary
              ? `${t('budgetBurn.portfolio.filters.bySubsidiary')}: ${selectedSubsidiary}`
              : t('budgetBurn.portfolio.filters.bySubsidiary')}
            {selectedSubsidiary ? (
              <X
                className="h-3 w-3"
                aria-hidden="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSubsidiary('');
                }}
              />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            )}
          </button>

          {showSubsidiaryPicker && (
            <div
              role="listbox"
              aria-label={t('budgetBurn.portfolio.filters.bySubsidiary')}
              className="absolute start-0 top-9 z-10 min-w-[160px] rounded-lg border border-border bg-card shadow-md"
            >
              <button
                type="button"
                role="option"
                aria-selected={selectedSubsidiary === ''}
                onClick={() => { setSelectedSubsidiary(''); setShowSubsidiaryPicker(false); }}
                className="block w-full px-3 py-2 text-start text-xs text-ink-muted hover:bg-surface"
              >
                {t('common.all', { defaultValue: 'All' })}
              </button>
              {ADNOC_SUBSIDIARIES.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  role="option"
                  aria-selected={selectedSubsidiary === sub}
                  onClick={() => { setSelectedSubsidiary(sub); setShowSubsidiaryPicker(false); }}
                  className={cn(
                    'block w-full px-3 py-2 text-start text-xs hover:bg-surface',
                    selectedSubsidiary === sub ? 'font-semibold text-ink' : 'text-ink-muted',
                  )}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* By emirate */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowEmiratePicker((v) => !v);
              setShowSubsidiaryPicker(false);
            }}
            aria-haspopup="listbox"
            aria-expanded={showEmiratePicker}
            className={cn(
              'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
              selectedEmirate
                ? 'border-gold bg-gold/10 text-ink'
                : 'border-border bg-card text-ink-muted hover:border-gold/60 hover:text-ink',
            )}
          >
            {selectedEmirate
              ? `${t('budgetBurn.portfolio.filters.byEmirate')}: ${selectedEmirate}`
              : t('budgetBurn.portfolio.filters.byEmirate')}
            {selectedEmirate ? (
              <X
                className="h-3 w-3"
                aria-hidden="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEmirate('');
                }}
              />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            )}
          </button>

          {showEmiratePicker && (
            <div
              role="listbox"
              aria-label={t('budgetBurn.portfolio.filters.byEmirate')}
              className="absolute start-0 top-9 z-10 min-w-[160px] rounded-lg border border-border bg-card shadow-md"
            >
              <button
                type="button"
                role="option"
                aria-selected={selectedEmirate === ''}
                onClick={() => { setSelectedEmirate(''); setShowEmiratePicker(false); }}
                className="block w-full px-3 py-2 text-start text-xs text-ink-muted hover:bg-surface"
              >
                {t('common.all', { defaultValue: 'All' })}
              </button>
              {emirateOptions.map((em) => (
                <button
                  key={em}
                  type="button"
                  role="option"
                  aria-selected={selectedEmirate === em}
                  onClick={() => { setSelectedEmirate(em); setShowEmiratePicker(false); }}
                  className={cn(
                    'block w-full px-3 py-2 text-start text-xs hover:bg-surface',
                    selectedEmirate === em ? 'font-semibold text-ink' : 'text-ink-muted',
                  )}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter count */}
        {(overBudgetOnly || selectedSubsidiary || selectedEmirate || search) && (
          <span className="text-xs text-ink-muted">
            {t('budgetBurn.portfolio.filters.showing', {
              count: filteredRows.length,
              total: sortedRows.length,
              defaultValue: '{{count}} of {{total}} contracts',
            })}
          </span>
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

          {/* ── Chart #5: Portfolio consumption horizontal bar ──── */}
          {chartRows.length > 0 && (
            <ChartCard
              title={t('budgetBurn.charts.portfolioConsumption.title')}
              subtitle={t('budgetBurn.charts.portfolioConsumption.subtitle')}
              height={280}
              empty={chartRows.length === 0}
              emptyLabel={t('common.charts.empty')}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  layout="vertical"
                  margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
                >
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} opacity={0.3} />
                  <XAxis
                    type="number"
                    fontSize={10}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    domain={[0, 'auto']}
                  />
                  <YAxis
                    dataKey="contractNumber"
                    type="category"
                    width={100}
                    fontSize={10}
                    tick={{ fill: 'var(--ink-muted)' }}
                  />
                  <SemanticTooltip
                    currencyHint="pct"
                    formatter={(value) => {
                      const n = typeof value === 'string' ? parseFloat(value) : Number(value);
                      return [`${n.toFixed(1)}%`, t('budgetBurn.charts.portfolioConsumption.consumed')];
                    }}
                  />
                  <Bar dataKey="pctConsumed" radius={[0, 3, 3, 0]}>
                    {chartRows.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={barFill(entry.pctConsumed)} />
                    ))}
                  </Bar>
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
              {/* Table head (static) */}
              <table className="min-w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('financial.budgetBurn.columns.contract')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('financial.budgetBurn.columns.counterparty')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                      {t('financial.budgetBurn.columns.budget')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                      {t('financial.budgetBurn.columns.actual')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                      {t('financial.budgetBurn.columns.consumed')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
                      {t('financial.budgetBurn.columns.projectedOverUnder')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('financial.budgetBurn.columns.status')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      <span className="sr-only">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
              </table>

              {/* Virtualized table body */}
              <div
                ref={parentRef}
                className="h-[600px] overflow-y-auto"
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
                        <table className="min-w-full text-sm">
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

  const projectedAed = parseFloat(row.projectedOverUnderAed);
  const projectedClass = projectedAed > 0 ? 'text-terracotta' : 'text-success';

  return (
    <tr className="border-b border-border transition-colors hover:bg-surface/50 last:border-0">
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
