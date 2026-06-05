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
import { useState, useMemo, useRef, type ReactNode } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
// Shared split-table alignment utility — keeps the sticky header and
// virtualized body in lockstep column-for-column.
import { ScrollbarReservedHeader, PercentColgroup } from '@/components/patterns';

// Column widths used by BOTH the head table and every per-row body table.
// 8 columns, must sum to 100.
// Mig 565 — Status column replaced by Variance column.
// Layout: Contract / Counterparty / Budget / Actual / Variance / % Consumed / Projected over/under / Action
const BUDGET_BURN_COL_WIDTHS = [22, 14, 10, 10, 12, 9, 13, 10] as const;
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

  // ── Mig 565 — explicit filters/sort/pagination state ───────
  type VarianceBucket = 'all' | 'currentlyOver' | 'trendingOver' | 'onTrack';
  type SortField =
    | 'variancePct'
    | 'varianceAed'
    | 'budgetAed'
    | 'actualAed'
    | 'pctConsumed'
    | 'projectedOverUnderAed'
    | 'contractNumber'
    | 'counterparty';
  const [varianceBucket, setVarianceBucket] = useState<VarianceBucket>('all');
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('variancePct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const pageSize = 25;
  const [pageNum, setPageNum] = useState<number>(1);

  // Distinct counterparties (alphabetical) — derived from the dataset.
  const counterpartyOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of allRows) {
      if (r.counterpartyName) s.add(r.counterpartyName);
    }
    return Array.from(s).sort();
  }, [allRows]);

  // Sort rows by the user-selected column.
  const sortedRows = useMemo(() => {
    const numeric = (r: PortfolioContractRow, key: SortField): number => {
      switch (key) {
        case 'variancePct':
          return r.variancePct ?? 0;
        case 'varianceAed':
          return parseFloat(r.varianceAed || '0');
        case 'budgetAed':
          return parseFloat(r.budgetAed || '0');
        case 'actualAed':
          return parseFloat(r.actualAed || '0');
        case 'pctConsumed':
          return r.pctConsumed ?? 0;
        case 'projectedOverUnderAed':
          return parseFloat(r.projectedOverUnderAed || '0');
        default:
          return 0;
      }
    };
    const txt = (r: PortfolioContractRow, key: SortField): string => {
      if (key === 'contractNumber') return r.contractNumber ?? '';
      if (key === 'counterparty') return r.counterpartyName ?? '';
      return '';
    };
    const isTextSort = sortField === 'contractNumber' || sortField === 'counterparty';
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...allRows].sort((a, b) => {
      if (isTextSort) {
        return txt(a, sortField).localeCompare(txt(b, sortField)) * mul;
      }
      return (numeric(a, sortField) - numeric(b, sortField)) * mul;
    });
  }, [allRows, sortField, sortDir]);

  const handleHeaderSort = (field: SortField) => {
    setPageNum(1);
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

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

    // Mig 565 — Variance bucket filter
    if (varianceBucket !== 'all') {
      rows = rows.filter((r) => {
        const projected = parseFloat(r.projectedOverUnderAed || '0');
        const isOver = r.varianceFlag || r.pctConsumed >= 100;
        if (varianceBucket === 'currentlyOver') return isOver;
        if (varianceBucket === 'trendingOver') return !isOver && projected > 0;
        if (varianceBucket === 'onTrack') return !isOver && projected <= 0;
        return true;
      });
    }

    // Mig 565 — Counterparty exact match
    if (counterpartyFilter) {
      rows = rows.filter((r) => (r.counterpartyName ?? '') === counterpartyFilter);
    }

    return rows;
  }, [sortedRows, search, overBudgetOnly, selectedSubsidiary, selectedEmirate, varianceBucket, counterpartyFilter]);

  // Paginate the filtered set
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (pageNum - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageNum, pageSize]);

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
    count: pagedRows.length,
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
            {t('financial.spendHealth.module.title', {
              defaultValue: 'Contract Spend Health',
            })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('financial.spendHealth.module.subtitle', {
              defaultValue:
                'Year-to-date budget vs actual across contracts with line-item budgets.',
            })}
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
          {/* Portfolio summary strip — restructured into two rows for
              "scope vs forward-looking" rhythm (mig 563 revamp). */}
          {summary && (
            <>
              {/* Row 1 — SCOPE: who's in the tracked set, lifetime numbers */}
              <section
                aria-label={t('financial.spendHealth.module.scopeLabel', {
                  defaultValue: 'Spend health — scope',
                })}
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                <SummaryTile
                  label={t('financial.spendHealth.module.trackedWithBudget', {
                    defaultValue: 'Tracked with budget',
                  })}
                  value={
                    summary.contractsTotalCount != null
                      ? t('financial.spendHealth.module.xOfYContracts', {
                          defaultValue: '{{x}} of {{y}}',
                          x: summary.contractsWithBudget,
                          y: summary.contractsTotalCount,
                        })
                      : String(summary.contractsWithBudget)
                  }
                  helper={
                    summary.contractsWithoutBudgetCount != null && summary.contractsWithoutBudgetCount > 0
                      ? t('financial.spendHealth.module.withoutBudgetHelper', {
                          defaultValue: '{{n}} contracts have no budget set',
                          n: summary.contractsWithoutBudgetCount,
                        })
                      : undefined
                  }
                />
                <SummaryTile
                  label={t('financial.spendHealth.module.totalFyBudget', {
                    defaultValue: 'Total FY budget',
                  })}
                  value={formatAed(summary.totalBudgetAed)}
                />
                <SummaryTile
                  label={t('financial.spendHealth.module.actualYtd', {
                    defaultValue: 'Actual YTD',
                  })}
                  value={formatAed(summary.totalActualAed)}
                />
                <SummaryTile
                  label={t('financial.spendHealth.module.varianceYtd', {
                    defaultValue: 'Variance YTD',
                  })}
                  value={formatAed(summary.totalVarianceAed)}
                  variant={
                    parseFloat(summary.totalVarianceAed) > 0
                      ? 'risk'
                      : parseFloat(summary.totalVarianceAed) < 0
                        ? 'success'
                        : 'default'
                  }
                  helper={t('financial.spendHealth.module.varianceHelper', {
                    defaultValue: 'Negative = under budget',
                  })}
                />
              </section>

              {/* Row 2 — FORWARD: what to act on */}
              <section
                aria-label={t('financial.spendHealth.module.forwardLabel', {
                  defaultValue: 'Spend health — forward',
                })}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                <SummaryTile
                  label={t('financial.spendHealth.module.currentlyOver', {
                    defaultValue: 'Currently over budget (YTD)',
                  })}
                  value={String(summary.overBudgetContractCount ?? summary.overBudgetCount ?? 0)}
                  variant={
                    (summary.overBudgetContractCount ?? summary.overBudgetCount ?? 0) > 0
                      ? 'risk'
                      : 'default'
                  }
                />
                <SummaryTile
                  label={t('financial.spendHealth.module.projectedToOverrun', {
                    defaultValue: 'Projected to overrun by FY end',
                  })}
                  value={
                    (summary.trendingOverContractCount ?? 0) > 0
                      ? t('financial.spendHealth.module.projectedSummary', {
                          defaultValue: '{{n}} contracts · {{aed}}',
                          n: summary.trendingOverContractCount ?? 0,
                          aed: formatAed(summary.totalProjectedOverrunAed),
                        })
                      : t('financial.spendHealth.module.allWithinTrack', {
                          defaultValue: 'All within track',
                        })
                  }
                  variant={parseFloat(summary.totalProjectedOverrunAed) > 0 ? 'risk' : 'success'}
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

          {/* Mig 566 — Filter row above the table (matches Contracts list
              pattern). Variance bucket + Counterparty only; page size
              kept at default 25 per user direction. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
            <FilterSelect
              label={t('financial.spendHealth.module.filters.varianceBucket', {
                defaultValue: 'Variance',
              })}
              value={varianceBucket}
              onChange={(v) => {
                setVarianceBucket(v as VarianceBucket);
                setPageNum(1);
              }}
              options={[
                { value: 'all', label: t('common.all', { defaultValue: 'All' }) },
                { value: 'currentlyOver', label: t('financial.spendHealth.module.filters.currentlyOver', { defaultValue: 'Currently over budget' }) },
                { value: 'trendingOver', label: t('financial.spendHealth.module.filters.trendingOver', { defaultValue: 'Trending to overrun' }) },
                { value: 'onTrack', label: t('financial.spendHealth.module.filters.onTrack', { defaultValue: 'On track' }) },
              ]}
            />
            <FilterSelect
              label={t('financial.spendHealth.module.filters.counterparty', {
                defaultValue: 'Counterparty',
              })}
              value={counterpartyFilter}
              onChange={(v) => {
                setCounterpartyFilter(v);
                setPageNum(1);
              }}
              options={[
                { value: '', label: t('common.all', { defaultValue: 'All' }) },
                ...counterpartyOptions.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>

          {/* ── Virtualized table — moved above the chart so the executive
              sees the contract-level breakdown first (the natural next
              question after "AED -2B variance" is "which contracts?"). */}
          {filteredRows.length === 0 ? (
            <Card>
              <CardContent className="flex h-56 flex-col items-center justify-center gap-3 p-8">
                <TrendingUp className="h-8 w-8 text-ink-subtle" aria-hidden="true" />
                <p className="text-sm font-medium text-ink">
                  {search || overBudgetOnly || selectedSubsidiary || selectedEmirate || varianceBucket !== 'all' || counterpartyFilter
                    ? t('budgetBurn.portfolio.filters.noResults', { defaultValue: 'No contracts match the current filters.' })
                    : t('financial.budgetBurn.portfolio.empty.title')}
                </p>
                <p className="text-xs text-ink-muted">
                  {!(search || overBudgetOnly || selectedSubsidiary || selectedEmirate || varianceBucket !== 'all' || counterpartyFilter) &&
                    t('financial.budgetBurn.portfolio.empty.body')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
              <ScrollbarReservedHeader>
              <table className="w-full table-fixed text-sm">
                <PercentColgroup widths={BUDGET_BURN_COL_WIDTHS} />
                <thead className="bg-surface">
                  <tr>
                    <SortableTh
                      align="left"
                      active={sortField === 'contractNumber'}
                      dir={sortDir}
                      onClick={() => handleHeaderSort('contractNumber')}
                    >
                      {t('financial.budgetBurn.columns.contract')}
                    </SortableTh>
                    <SortableTh
                      align="left"
                      active={sortField === 'counterparty'}
                      dir={sortDir}
                      onClick={() => handleHeaderSort('counterparty')}
                    >
                      {t('financial.budgetBurn.columns.counterparty')}
                    </SortableTh>
                    <SortableTh
                      align="right"
                      active={sortField === 'budgetAed'}
                      dir={sortDir}
                      onClick={() => handleHeaderSort('budgetAed')}
                    >
                      {t('financial.budgetBurn.columns.budget')}
                    </SortableTh>
                    <SortableTh
                      align="right"
                      active={sortField === 'actualAed'}
                      dir={sortDir}
                      onClick={() => handleHeaderSort('actualAed')}
                    >
                      {t('financial.budgetBurn.columns.actual')}
                    </SortableTh>
                    <SortableTh
                      align="right"
                      active={sortField === 'pctConsumed'}
                      dir={sortDir}
                      onClick={() => handleHeaderSort('pctConsumed')}
                    >
                      {t('financial.budgetBurn.columns.consumed')}
                    </SortableTh>
                    <SortableTh
                      align="right"
                      active={sortField === 'varianceAed'}
                      dir={sortDir}
                      onClick={() => handleHeaderSort('varianceAed')}
                    >
                      {t('financial.spendHealth.module.columns.variance', {
                        defaultValue: 'Variance',
                      })}
                    </SortableTh>
                    <SortableTh
                      align="right"
                      active={sortField === 'projectedOverUnderAed'}
                      dir={sortDir}
                      onClick={() => handleHeaderSort('projectedOverUnderAed')}
                    >
                      {t('financial.budgetBurn.columns.projectedOverUnder')}
                    </SortableTh>
                    <th scope="col" className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      {t('common.action', { defaultValue: 'Action' })}
                    </th>
                  </tr>
                </thead>
              </table>
              </ScrollbarReservedHeader>

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
                    const row = pagedRows[virtualRow.index];
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

              {/* Footer — row count + pagination controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-ink-muted">
                <span>
                  {t('financial.spendHealth.module.showingRange', {
                    defaultValue: '{{from}}–{{to}} of {{total}}',
                    from: filteredRows.length === 0 ? 0 : (pageNum - 1) * pageSize + 1,
                    to: Math.min(pageNum * pageSize, filteredRows.length),
                    total: filteredRows.length,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPageNum((p) => Math.max(p - 1, 1))}
                    disabled={pageNum <= 1}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('common.previous', { defaultValue: 'Previous' })}
                  </button>
                  <span className="tabular-nums">
                    {t('financial.spendHealth.module.pageOf', {
                      defaultValue: 'Page {{page}} of {{total}}',
                      page: pageNum,
                      total: totalPages,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPageNum((p) => Math.min(p + 1, totalPages))}
                    disabled={pageNum >= totalPages}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('common.next', { defaultValue: 'Next' })}
                  </button>
                </div>
              </div>
              </CardContent>
            </Card>
          )}

          {/* ── Portfolio consumption chart (moved below the table). ──── */}
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
                  {/* Mig 565 — YAxis bumped 140 → 180 so contract numbers
                      like CRN-296-HERO-001 + interval=0 so every label
                      renders even on dense lists. */}
                  <YAxis
                    dataKey="contractNumber"
                    type="category"
                    width={180}
                    fontSize={10}
                    tickMargin={4}
                    interval={0}
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
  const varianceAed = parseFloat(row.varianceAed || '0');
  // Variance = actual - budget. Positive (over) is BAD → terracotta.
  // Negative (under budget) is GOOD → sage success token.
  const varianceClass =
    varianceAed > 0 ? 'text-terracotta' : varianceAed < 0 ? 'text-success' : 'text-ink';

  return (
    <tr className="border-b border-border transition-colors hover:bg-surface/50 last:border-0">
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{row.contractNumber}</p>
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
      {/* Mig 566 — % Consumed now precedes Variance (per user request).
          Plain number only — no burn bar / percent suffix. */}
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sm">
        <span className={row.pctConsumed >= 100 ? 'text-terracotta' : 'text-ink'}>
          {row.pctConsumed.toFixed(1)}%
        </span>
      </td>
      {/* Mig 567 — Variance shows the bare AED magnitude (no leading
          sign — colour already conveys direction: terracotta = over,
          sage = under). */}
      <td className={`px-4 py-3 text-right font-mono tabular-nums text-sm ${varianceClass}`}>
        {formatAed(String(Math.abs(varianceAed)))}
      </td>
      <td className={`px-4 py-3 text-right font-mono tabular-nums text-sm ${projectedClass}`}>
        {projectedAed > 0 ? '+' : ''}{formatAed(row.projectedOverUnderAed)}
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

/**
 * FilterSelect — labelled select for the filter row above the table
 * (mig 565). Same shape as the Contracts list's FilterSelect so the
 * two surfaces stay visually consistent.
 */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value || '_all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * SortableTh — column header that toggles sort field/direction on click.
 * Used by the Contract Spend Health portfolio table (mig 565).
 */
function SortableTh({
  children,
  align,
  active,
  dir,
  onClick,
}: {
  children: ReactNode;
  align: 'left' | 'right';
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  // Mig 566 — inactive headers show a subtle ⇅ so first-time users see
  // the column is sortable. Active header shows the direction arrow.
  return (
    <th
      scope="col"
      className={`px-4 py-3 font-mono text-[10px] uppercase tracking-wider ${active ? 'text-ink' : 'text-ink-subtle'} ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex w-full items-center gap-1 hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary ${align === 'right' ? 'justify-end' : 'justify-start'}`}
      >
        {children}
        {active ? (
          <span aria-hidden="true" className="text-ink">
            {dir === 'asc' ? '▲' : '▼'}
          </span>
        ) : (
          <span aria-hidden="true" className="text-ink-subtle/60 opacity-60">
            ⇅
          </span>
        )}
      </button>
    </th>
  );
}
