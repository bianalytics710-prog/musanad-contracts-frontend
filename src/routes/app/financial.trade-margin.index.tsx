/**
 * /app/financial/trade-margin — Trade Margin Positions list (index).
 *
 * CR-O — M21 Financial Intelligence (Trade Margin). Primary persona: finance_treasury.
 * CR-S — Aggregate tab augmented with charts #4 (margin by side) and #5 (by counterparty).
 * Read access: finance_treasury, executive, platform_admin, Super Admin.
 *
 * AC#1: Seller + buyer positions list with side badge, grade, counterparty,
 *       volume, pricing basis, margin/bbl, total margin (AED + USD), status.
 * AC#3: Filter by side (sell / buy).
 * AC#5: Aggregate margin by counterparty / quarter / side (CFO rollup tab).
 *
 * Standards:
 *   A7:  all HTTP via financialTradeMarginService
 *   C13: no raw hex — semantic tokens only
 *   C14: Router Link for internal nav
 *   D6:  htmlFor+id on filter labels
 *   D7:  scope="col" on all <th>
 *   T3:  all strings via t()
 *   T4:  loading / empty / error states
 *   T10: useDebounce(300) on search input
 *   T11: ErrorBoundary at route level
 *   T12: formatDateTime for timestamps
 */
import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
// E41 fix — humanize grade slug for display.
import { humanizeLabel } from '@/features/dashboards/components/dashboard-primitives';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowUpRight,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Minus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { ChartCard, SemanticTooltip } from '@/components/charts';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { financialTradeMarginService } from '@/services/api/financial-trade-margin.service';
import {
  indexLinkedCatalogService,
  type CatalogBenchmark,
} from '@/services/api/index-linked-catalog.service';
import { translateApiError } from '@/lib/translate-api-error';
// E-rev-O — Search input restored for the positions filter row.
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { HelpCircle, Search } from 'lucide-react';
// mig 593 — Tooltip on the "Margin impact" labels to explain what the
// number actually means (forward-only exposure if buyer invokes clause).
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  TradePositionListItem,
  TradePositionListQuery,
  MarginAggregateQuery,
  MarginAggregateResult,
  TradeSide,
  BandStatus,
  MarginRecommendation,
} from '@/types/entities/trade-margin.types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Chart color tokens — semantic, no raw hex (C13)
const C1 = 'var(--chart-1)'; // gold — sell
const C2 = 'var(--chart-2)'; // sage — buy
const C3 = 'var(--chart-3)';
const C4 = 'var(--chart-4)';
const CHART_COLORS = [C1, C2, C3, C4];

export const Route = createFileRoute('/app/financial/trade-margin/')({
  component: () => (
    <ErrorBoundary>
      <TradeMarginPortfolioView />
    </ErrorBoundary>
  ),
});

// ─────────────────────────────────────────────────────────────
// Money formatters — parseFloat guard; no raw hex (C13)
// ─────────────────────────────────────────────────────────────
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

function formatUsdPerBbl(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  return `$${n.toFixed(2)}/bbl`;
}

function formatVolume(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M bbl`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K bbl`;
  return `${n.toFixed(0)} bbl`;
}

// ─────────────────────────────────────────────────────────────
// Side badge
// ─────────────────────────────────────────────────────────────
function SideBadge({ side }: { side: TradeSide }) {
  const { t } = useTranslation();
  const isSell = side === 'sell';
  return (
    // E42 fix — drop forced uppercase so the badge reads "Sell" / "Buy"
    // and stops conflicting with the row's other side cell that uses
    // title-case.
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
        isSell
          ? 'border border-gold/30 bg-gold/10 text-gold'
          : 'border border-sage/30 bg-sage/10 text-sage'
      }`}
    >
      {isSell
        ? t('financial.tradeMargin.side.sell')
        : t('financial.tradeMargin.side.buy')}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Recommendation badge
// ─────────────────────────────────────────────────────────────
function RecommendationBadge({
  rec,
}: {
  rec: MarginRecommendation | null | undefined;
}) {
  const { t } = useTranslation();
  if (!rec) return <span className="text-ink-subtle">—</span>;
  const colorMap: Record<MarginRecommendation, string> = {
    buy: 'border-success/30 bg-success/10 text-success',
    sell: 'border-gold/30 bg-gold/10 text-gold',
    hold: 'border-ink-muted/30 bg-surface text-ink-muted',
    review: 'border-warning/30 bg-warning/10 text-warning',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorMap[rec]}`}
    >
      {t(`financial.tradeMargin.recommendation.${rec}`)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colorMap: Record<string, string> = {
    open: 'border-success/30 bg-success/10 text-success',
    priced: 'border-gold/30 bg-gold/10 text-gold',
    closed: 'border-border bg-surface text-ink-muted',
  };
  const cls = colorMap[status] ?? 'border-border bg-surface text-ink-muted';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {t(`financial.tradeMargin.status.${status}`, { defaultValue: status })}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────
function TradeMarginPortfolioView() {
  const { t } = useTranslation();
  const canRead = useAuthStore(selectHasPermission('finance.margin.read'));

  const [page, setPage] = useState(1);
  // E-rev-O — Search input restored alongside the band-status filter so
  // users can type-to-find a contract or counterparty without scrolling.
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [bandFilter, setBandFilter] = useState<
    'all' | 'within' | 'edge' | 'outside' | 'no_band'
  >('all');
  // E-rev-I — Aggregate tab dropped; activeTab kept as a constant so the
  // rest of the conditional blocks compile without churn.
  const activeTab = 'positions' as const;
  // E-rev-H — Bulk-escalate state lives at this level so the dialog can
  // reach the page's row set.
  const [escalateTarget, setEscalateTarget] = useState<TradePositionListItem | null>(null);

  // R-IL — table sort (mirrors Contract Spend Health pattern).
  type SortField =
    | 'positionRef'
    | 'counterparty'
    | 'volumeBbl'
    | 'osp'
    | 'marginPerBbl'
    | 'totalMarginAed'
    | 'bandStatus';
  const [sortField, setSortField] = useState<SortField>('totalMarginAed');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const LIMIT = 50;

  // E-rev-H — Story 5a is sell-side only. Buy positions exist in the DB but
  // are hidden from the demo view; the side filter UI is gone.
  const positionsParams = useMemo<TradePositionListQuery>(
    () => ({
      page,
      limit: LIMIT,
      side: 'sell' as TradeSide,
    }),
    [page],
  );

  // R-IL — Tenant-resolved benchmark catalog. Drives the kicker text +
  // what-if slider bounds + the "Benchmark today" tile label. Falls back
  // to i18n defaultValue when catalog is unavailable.
  const { data: catalogBenchmarks } = useQuery({
    queryKey: ['index-linked-catalog-benchmarks'],
    queryFn: () => indexLinkedCatalogService.benchmarks(),
    staleTime: 5 * 60_000,
    enabled: canRead,
  });
  const primaryBenchmark: CatalogBenchmark | undefined =
    catalogBenchmarks?.find((b) => !b.isFx);
  // E-rev-I — Aggregate query dropped along with its tab.

  const {
    data: positionsData,
    isLoading: positionsLoading,
    isError: positionsError,
    error: positionsErr,
    refetch: refetchPositions,
  } = useQuery({
    queryKey: ['trade-margin-positions', positionsParams],
    queryFn: () =>
      financialTradeMarginService.listPositions(positionsParams),
    enabled: canRead && activeTab === 'positions',
    staleTime: 30_000,
  });

  // E-rev-I — Aggregate query no longer fired.

  if (!canRead) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  const rows = positionsData?.data ?? [];
  const pagination = positionsData?.pagination;

  // R-IL — apply sort across filtered rows. Text sorts use localeCompare,
  // numeric sorts coerce strings → numbers, NULLs sort last.
  function sortRows(rs: TradePositionListItem[]): TradePositionListItem[] {
    const mul = sortDir === 'asc' ? 1 : -1;
    const num = (v: string | null | undefined) => (v == null ? Number.NEGATIVE_INFINITY : parseFloat(v));
    const bandRank = (r: TradePositionListItem) => {
      const m: Record<string, number> = {
        within_band: 0, at_floor: 1, at_ceiling: 2, below_floor: 3, above_ceiling: 4, no_band: 5,
      };
      return m[r.bandStatus ?? 'no_band'] ?? 99;
    };
    return [...rs].sort((a, b) => {
      switch (sortField) {
        case 'positionRef':
          return a.positionRef.localeCompare(b.positionRef) * mul;
        case 'counterparty':
          return (a.counterparty?.nameEn ?? '').localeCompare(b.counterparty?.nameEn ?? '') * mul;
        case 'volumeBbl':
          return (num(a.volumeBbl) - num(b.volumeBbl)) * mul;
        case 'osp':
          return (num(a.latestBenchmarkUsdPerBbl) - num(b.latestBenchmarkUsdPerBbl)) * mul;
        case 'marginPerBbl':
          return (num(a.marginPerBbl) - num(b.marginPerBbl)) * mul;
        case 'totalMarginAed':
          return (num(a.totalMarginAed) - num(b.totalMarginAed)) * mul;
        case 'bandStatus':
          return (bandRank(a) - bandRank(b)) * mul;
      }
    });
  }

  // E-rev-J — Apply band-status filter to the displayed rows. The KPI strip
  // and scenario panel keep using the unfiltered rows (those describe the
  // entire portfolio, not the current view).
  // E-rev-O — Search term is debounced (300 ms) and matches case-insensitively
  // against position_ref, counterparty name, grade.
  const searchLower = debouncedSearch.trim().toLowerCase();
  const filteredRows = rows.filter((r) => {
    const b: BandStatus = r.bandStatus ?? 'no_band';
    const bandOk = (() => {
      switch (bandFilter) {
        case 'within':  return b === 'within_band';
        case 'edge':    return b === 'at_floor' || b === 'at_ceiling';
        case 'outside': return b === 'below_floor' || b === 'above_ceiling';
        case 'no_band': return b === 'no_band';
        case 'all':
        default:        return true;
      }
    })();
    if (!bandOk) return false;
    if (searchLower.length === 0) return true;
    const hay = (
      (r.positionRef ?? '') +
      ' ' + (r.counterparty?.nameEn ?? '') +
      ' ' + (r.counterparty?.nameAr ?? '') +
      ' ' + (r.grade ?? '')
    ).toLowerCase();
    return hay.includes(searchLower);
  });
  const sortedRows = sortRows(filteredRows);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      {/* Header */}
      <div>
        {/* E-rev-I — Match contracts-page kicker pattern + drop "Positions"
            qualifier; only positions are shown anyway. */}
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          {primaryBenchmark?.kickerText ??
            t('financial.tradeMargin.portfolio.kicker', {
              defaultValue: 'Index-linked pricing exposure',
            })}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t('financial.tradeMargin.portfolio.title', {
            defaultValue: 'Index-Linked Contracts',
          })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('financial.tradeMargin.portfolio.subtitle', {
            defaultValue:
              'Contracts whose price floats with an external index — band-protection status and margin impact.',
          })}
        </p>
      </div>

      {/* E-rev-I — Aggregate tab dropped. Page is positions-only. */}

      {/* ── Positions tab ── */}
      {activeTab === 'positions' && (
        <>
          {/* E-rev-J — Search + side filter both dropped. Dataset small
              enough that band-status pill chips below the KPI strip handle
              filtering. */}

          {/* E-rev-H — Sell-side KPI strip + Murban-OSP context, sourced
              entirely from the rows already in memory. Lights up the
              demo story before the table. */}
          {!positionsLoading && rows.length > 0 && (
            <SellSideKpiStrip rows={rows} benchmark={primaryBenchmark} />
          )}
          {/* E-rev-O — Filter row above the table. The Band-status select and
              Search input live side-by-side. The What-If panel now sits BELOW
              the table so users see their actual portfolio first and run
              scenarios after they've explored it. */}
          {!positionsLoading && rows.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
              <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                <label
                  htmlFor="tm-search"
                  className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
                >
                  {t('financial.tradeMargin.filters.search', {
                    defaultValue: 'Search',
                  })}
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle"
                    aria-hidden="true"
                  />
                  <Input
                    id="tm-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('financial.tradeMargin.filters.searchPlaceholder', {
                      defaultValue: 'Position ref, counterparty…',
                    })}
                    className="h-8 ps-7 text-xs"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 lg:col-span-2">
                <label
                  htmlFor="tm-band-filter"
                  className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
                >
                  {t('financial.tradeMargin.filters.bandStatus', {
                    defaultValue: 'Band status',
                  })}
                </label>
                <select
                  id="tm-band-filter"
                  value={bandFilter}
                  onChange={(e) => setBandFilter(e.target.value as typeof bandFilter)}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">
                    {t('common.all', { defaultValue: 'All' })}
                  </option>
                  <option value="within">
                    {t('financial.tradeMargin.bandStatus.within', {
                      defaultValue: 'Within band',
                    })}
                  </option>
                  <option value="edge">
                    {t('financial.tradeMargin.filters.bandStatusEdge', {
                      defaultValue: 'At floor or ceiling',
                    })}
                  </option>
                  <option value="outside">
                    {t('financial.tradeMargin.filters.bandStatusOutside', {
                      defaultValue: 'Outside band — escalate',
                    })}
                  </option>
                  <option value="no_band">
                    {t('financial.tradeMargin.bandStatus.noBand', {
                      defaultValue: 'No price-protection clause',
                    })}
                  </option>
                </select>
              </div>
            </div>
          )}

          {/* Loading */}
          {positionsLoading && (
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
          {positionsError && (
            <div
              className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
              role="alert"
            >
              <AlertTriangle
                className="h-5 w-5 shrink-0 text-error"
                aria-hidden="true"
              />
              <p className="text-sm text-error">
                {translateApiError(
                  positionsErr,
                  t,
                  'financial.tradeMargin.errors.fetchFailed',
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refetchPositions()}
              >
                <RefreshCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {t('common.retry')}
              </Button>
            </div>
          )}

          {/* Positions table */}
          {!positionsLoading && !positionsError && (
            <>
              {rows.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card">
                  <ArrowUpDown
                    className="h-8 w-8 text-ink-subtle"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-ink">
                    {t('financial.tradeMargin.portfolio.empty.title')}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {t('financial.tradeMargin.portfolio.empty.body')}
                  </p>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-border bg-surface">
                          <tr>
                            {/* R-IL — all headers center-aligned for uniform top row.
                                Data cells keep their own alignment (numeric right, text left). */}
                            <SortableTh align="center" active={sortField === 'positionRef'} dir={sortDir} onClick={() => handleHeaderSort('positionRef')}>
                              {t('financial.tradeMargin.columns.position', { defaultValue: 'Contract' })}
                            </SortableTh>
                            <SortableTh align="center" active={sortField === 'counterparty'} dir={sortDir} onClick={() => handleHeaderSort('counterparty')}>
                              {t('financial.tradeMargin.columns.counterparty', { defaultValue: 'Counterparty' })}
                            </SortableTh>
                            <SortableTh align="center" active={sortField === 'volumeBbl'} dir={sortDir} onClick={() => handleHeaderSort('volumeBbl')}>
                              {t('financial.tradeMargin.columns.volume', { defaultValue: 'Volume' })}
                            </SortableTh>
                            <th scope="col" className="whitespace-nowrap px-3 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                              {t('financial.tradeMargin.columns.contractedBandShort', { defaultValue: 'Band' })}
                            </th>
                            <SortableTh align="center" active={sortField === 'osp'} dir={sortDir} onClick={() => handleHeaderSort('osp')}>
                              {t('financial.tradeMargin.columns.ospTodayShort', { defaultValue: 'OSP' })}
                            </SortableTh>
                            <SortableTh align="center" active={sortField === 'marginPerBbl'} dir={sortDir} onClick={() => handleHeaderSort('marginPerBbl')}>
                              {t('financial.tradeMargin.columns.marginPerBblShort', { defaultValue: 'Margin' })}
                            </SortableTh>
                            <SortableTh align="center" active={sortField === 'totalMarginAed'} dir={sortDir} onClick={() => handleHeaderSort('totalMarginAed')}>
                              {t('financial.tradeMargin.columns.currentMarginAedShort', { defaultValue: 'Current margin (AED)' })}
                            </SortableTh>
                            <SortableTh align="center" active={sortField === 'bandStatus'} dir={sortDir} onClick={() => handleHeaderSort('bandStatus')}>
                              {t('financial.tradeMargin.columns.bandStatus', { defaultValue: 'Band status' })}
                            </SortableTh>
                            {/* E-rev-N — Actions header gets explicit width so View/Escalate
                                buttons render fully inside the cell. */}
                            <th scope="col" className="whitespace-nowrap px-3 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink-subtle min-w-[100px]">
                              <span className="sr-only">{t('common.actions')}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={9}
                                className="px-4 py-8 text-center text-xs text-ink-muted"
                              >
                                {t('financial.tradeMargin.filters.noMatch', {
                                  defaultValue:
                                    'No positions match the current band-status filter.',
                                })}
                              </td>
                            </tr>
                          ) : (
                            sortedRows.map((row) => (
                              <PositionRow
                                key={row.id}
                                row={row}
                                onEscalate={() => setEscalateTarget(row)}
                              />
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pagination */}
              {pagination && pagination.total > LIMIT && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-ink-muted">
                    {t('financial.tradeMargin.portfolio.showing', {
                      from: (page - 1) * LIMIT + 1,
                      to: Math.min(page * LIMIT, pagination.total),
                      total: pagination.total,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.max(1, p - 1))
                      }
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

          {/* E-rev-O — What-If OSP panel now sits BELOW the table. The
              user reviews their actual positions + applies filters first;
              the scenario simulator is a follow-up tool, not the headline.
              Uses the unfiltered `rows` so the simulation always reflects
              the full portfolio regardless of the table filter state. */}
          {!positionsLoading && rows.length > 0 && (
            <WhatIfOspPanel
              rows={rows}
              onEscalate={(row) => setEscalateTarget(row)}
              benchmark={primaryBenchmark}
            />
          )}
        </>
      )}

      {/* E-rev-I — Aggregate tab block removed entirely. */}

      {/* E-rev-H — Escalate dialog (renders only when target set) */}
      <EscalateBandDialog
        target={escalateTarget}
        onClose={() => setEscalateTarget(null)}
      />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// E-rev-H — SellSideKpiStrip
// 4 KPI tiles for the sell-side story 5a:
//   - Open sell positions
//   - Total sell margin (AED)
//   - Latest Murban OSP (from the rows' latestBenchmarkUsdPerBbl)
//   - Positions outside band OR with no band (escalate candidates)
// ─────────────────────────────────────────────────────────────
function SellSideKpiStrip({
  rows,
  benchmark,
}: {
  rows: TradePositionListItem[];
  benchmark?: CatalogBenchmark;
}) {
  const { t } = useTranslation();
  const totalMarginAed = rows.reduce(
    (sum, r) => sum + (r.totalMarginAed ? parseFloat(r.totalMarginAed) : 0),
    0,
  );
  // Murban-pricing rows carry the latest OSP via latestBenchmarkUsdPerBbl;
  // grab the first non-null value (all Murban rows share the same number).
  const murbanRow = rows.find(
    (r) => r.pricingBasis === 'murban_osp' && r.latestBenchmarkUsdPerBbl != null,
  );
  const ospToday = murbanRow?.latestBenchmarkUsdPerBbl;
  const exposed = rows.filter(
    (r) =>
      r.bandStatus === 'no_band' ||
      r.bandStatus === 'below_floor' ||
      r.bandStatus === 'above_ceiling',
  );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-border bg-card p-4">
        {/* E-rev-J — Re-labeled. Buy-side is hidden, so "sell" qualifier is
            redundant. "Active term cargoes" is the trader-natural term for
            open sell positions delivering in the demo horizon. */}
        <p className="text-xs text-ink-muted">
          {t('financial.tradeMargin.kpi.activeCargoes', {
            defaultValue: 'Open contracts',
          })}
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {rows.length}
        </p>
        <p className="mt-0.5 text-[10px] text-ink-subtle">
          {t('financial.tradeMargin.kpi.activeCargoesHelper', {
            defaultValue: 'Index-linked contracts open today',
          })}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-ink-muted">
          {t('financial.tradeMargin.kpi.totalSellMargin', {
            defaultValue: 'Total sell margin (AED)',
          })}
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {formatAedCompact(String(totalMarginAed))}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-ink-muted">
          {benchmark?.displayLabelEn
            ? `${benchmark.displayLabelEn} today`
            : t('financial.tradeMargin.kpi.murbanOspToday', {
                defaultValue: 'Benchmark today',
              })}
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {ospToday != null ? `$${parseFloat(ospToday).toFixed(2)}` : '—'}
        </p>
        <p className="mt-0.5 text-[10px] text-ink-subtle">
          {benchmark?.volumeUnitLabel
            ? `per ${benchmark.volumeUnitLabel}`
            : t('financial.tradeMargin.kpi.ospUnit', { defaultValue: 'per unit' })}
        </p>
      </div>
      <div
        className={
          'rounded-lg border p-4 ' +
          (exposed.length > 0
            ? 'border-terracotta/30 bg-terracotta/5'
            : 'border-sage/30 bg-sage/5')
        }
      >
        <p className="text-xs text-ink-muted">
          {t('financial.tradeMargin.kpi.exposedPositions', {
            defaultValue: 'Outside band or unprotected',
          })}
        </p>
        <p
          className={
            'mt-1 text-xl font-semibold tabular-nums ' +
            (exposed.length > 0 ? 'text-terracotta' : 'text-sage-ink')
          }
        >
          {exposed.length}
        </p>
        <p className="mt-0.5 text-[10px] text-ink-subtle">
          {exposed.length > 0
            ? t('financial.tradeMargin.kpi.exposedHelper', {
                defaultValue: 'Escalate to drafter',
              })
            : t('financial.tradeMargin.kpi.allProtectedHelper', {
                defaultValue: 'All positions inside band',
              })}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// E-rev-L — WhatIfOspPanel
// Replaces the static "Today vs +$1" panel with a live what-if simulator.
// User picks any Murban OSP via slider/input; the panel recomputes:
//   - How many positions go outside band at that OSP
//   - Total AED margin compression at that level
//   - Which affected positions LACK a price-protection clause (escalate as
//     amendment) vs WITH a clause (escalate as band-renegotiation)
// Each affected position has an inline Escalate button that opens the same
// dialog the list rows use.
// ─────────────────────────────────────────────────────────────
function WhatIfOspPanel({
  rows,
  onEscalate,
  benchmark,
}: {
  rows: TradePositionListItem[];
  onEscalate: (row: TradePositionListItem) => void;
  benchmark?: CatalogBenchmark;
}) {
  const { t } = useTranslation();
  // Anchor the slider to today's published OSP.
  const todaysOsp = (() => {
    const r = rows.find(
      (x) => x.pricingBasis === 'murban_osp' && x.latestBenchmarkUsdPerBbl != null,
    );
    return r ? parseFloat(r.latestBenchmarkUsdPerBbl ?? '0') : 103;
  })();
  const [whatIfOsp, setWhatIfOsp] = useState<number>(todaysOsp);
  // E-rev-P — Click an affected row to expand its calculation breakdown.
  // Set of position ids whose row is currently expanded.
  const [expandedRowIds, setExpandedRowIds] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) =>
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // R-IL — slider bounds come from the catalog row (typical_low / typical_high).
  // Fallback to 80–130 when catalog unavailable (back-compat).
  const sliderMin = benchmark?.typicalLow != null ? parseFloat(benchmark.typicalLow) : 80;
  const sliderMax = benchmark?.typicalHigh != null ? parseFloat(benchmark.typicalHigh) : 130;

  const usdAed = 3.67;
  // For each position, compute hypothetical band status + AED compression
  // at the chosen what-if OSP.
  const evaluated = rows.map((r) => {
    const floor = r.contractedFloorUsdPerBbl
      ? parseFloat(r.contractedFloorUsdPerBbl)
      : null;
    const ceiling = r.contractedCeilingUsdPerBbl
      ? parseFloat(r.contractedCeilingUsdPerBbl)
      : null;
    const vol = parseFloat(r.volumeBbl ?? '0');
    const hasClause = !!r.bandReviewClauseRef && (floor != null || ceiling != null);
    let status: 'within' | 'above_ceiling' | 'below_floor' | 'no_band';
    let compressionAed = 0;
    if (floor == null && ceiling == null) {
      // No band — full OSP exposure.
      status = 'no_band';
      const baselineMargin = r.totalMarginAed ? parseFloat(r.totalMarginAed) : 0;
      // Margin shifts $1/bbl per $1 OSP move (roughly). Drop = OSP today - whatIf.
      compressionAed = Math.max(0, todaysOsp - whatIfOsp) * vol * usdAed;
      // (Margin compression is real only when OSP drops; on a rise margin
      // expands for an integrated trader. Keep symmetric for above too.)
      compressionAed = Math.abs(todaysOsp - whatIfOsp) * vol * usdAed;
      void baselineMargin;
    } else if (ceiling != null && whatIfOsp > ceiling) {
      status = 'above_ceiling';
      compressionAed = (whatIfOsp - ceiling) * vol * usdAed;
    } else if (floor != null && whatIfOsp < floor) {
      status = 'below_floor';
      compressionAed = (floor - whatIfOsp) * vol * usdAed;
    } else {
      status = 'within';
    }
    return { row: r, status, compressionAed, hasClause };
  });

  const affected = evaluated.filter((e) => e.status !== 'within');
  const totalCompression = affected.reduce((s, e) => s + e.compressionAed, 0);
  const withClause = affected.filter((e) => e.hasClause);
  const withoutClause = affected.filter((e) => !e.hasClause);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {benchmark?.displayLabelEn
              ? `What-if analysis — ${benchmark.displayLabelEn}`
              : t('financial.tradeMargin.whatIf.title', {
                  defaultValue: 'What-if analysis — benchmark',
                })}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {t('financial.tradeMargin.whatIf.intro', {
              defaultValue:
                'Slide to a hypothetical benchmark price. The panel recomputes which contracts breach band, by how much in AED, and which need a contract amendment vs. a band re-negotiation.',
            })}
          </p>
        </div>
        <div className="text-end">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t('financial.tradeMargin.whatIf.ospToday', {
              defaultValue: 'OSP today',
            })}
          </p>
          <p className="font-mono text-sm text-ink">${todaysOsp.toFixed(2)}</p>
        </div>
      </div>

      {/* Slider + numeric input */}
      <div className="mb-4 grid items-center gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={0.5}
          value={whatIfOsp}
          onChange={(e) => setWhatIfOsp(parseFloat(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-gold"
          aria-label={t('financial.tradeMargin.whatIf.sliderLabel', {
            defaultValue: 'Hypothetical benchmark price',
          })}
        />
        <div className="flex items-center gap-2">
          <label htmlFor="tm-whatif-input" className="text-xs text-ink-muted">
            $
          </label>
          <input
            id="tm-whatif-input"
            type="number"
            min={sliderMin}
            max={sliderMax}
            step={0.25}
            value={whatIfOsp.toFixed(2)}
            onChange={(e) => setWhatIfOsp(parseFloat(e.target.value) || todaysOsp)}
            className="h-8 w-20 rounded-md border border-border bg-surface px-2 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-[10px] font-medium text-ink-muted hover:bg-surface"
            onClick={() => setWhatIfOsp(todaysOsp)}
          >
            {t('financial.tradeMargin.whatIf.reset', { defaultValue: 'Reset' })}
          </button>
        </div>
      </div>

      {/* Top-line numbers */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
            {t('financial.tradeMargin.whatIf.affectedLabel', {
              defaultValue: 'Positions outside band',
            })}
          </p>
          <p className={`mt-0.5 font-mono text-xl tabular-nums ${affected.length > 0 ? 'text-terracotta' : 'text-sage-ink'}`}>
            {affected.length}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-subtle">
            {t('financial.tradeMargin.whatIf.compressionLabel', {
              defaultValue: 'Total margin impact',
            })}
            {/* mig 593 — explain the formula so viewers don't confuse this
                with the realised "current margin" column in the table. */}
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('financial.tradeMargin.whatIf.compressionTooltipAria', {
                      defaultValue: 'How is margin impact calculated?',
                    })}
                    className="text-ink-subtle hover:text-ink"
                  >
                    <HelpCircle className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                  {t('financial.tradeMargin.whatIf.compressionTooltip', {
                    defaultValue:
                      'Forward-only exposure if the buyer invokes the price-review clause. Per-position: (benchmark OSP − contracted ceiling) × volume × USD→AED rate. Earned margin to date is unaffected.',
                  })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
          <p className={`mt-0.5 font-mono text-xl tabular-nums ${affected.length > 0 ? 'text-terracotta' : 'text-sage-ink'}`}>
            {affected.length > 0 ? formatAedCompact(String(Math.round(totalCompression))) : 'AED 0'}
          </p>
        </div>
        <div className="rounded-md border border-amber-tint bg-amber-tint/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
            {t('financial.tradeMargin.whatIf.amendmentLabel', {
              defaultValue: 'Need amendment (no clause)',
            })}
          </p>
          <p className="mt-0.5 font-mono text-xl tabular-nums text-amber-ink">
            {withoutClause.length}
          </p>
        </div>
      </div>

      {/* Affected rows — click row to expand the calculation breakdown. */}
      {affected.length > 0 ? (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t('financial.tradeMargin.whatIf.affectedRows', {
              defaultValue: 'Affected positions at this OSP',
            })}
          </p>
          <ul className="space-y-2">
            {affected.map((e) => {
              const expanded = expandedRowIds.has(e.row.id);
              const vol = parseFloat(e.row.volumeBbl ?? '0');
              const floorNum = e.row.contractedFloorUsdPerBbl
                ? parseFloat(e.row.contractedFloorUsdPerBbl) : null;
              const ceilingNum = e.row.contractedCeilingUsdPerBbl
                ? parseFloat(e.row.contractedCeilingUsdPerBbl) : null;
              const overshootUsd = (() => {
                if (e.status === 'above_ceiling' && ceilingNum != null)
                  return whatIfOsp - ceilingNum;
                if (e.status === 'below_floor' && floorNum != null)
                  return floorNum - whatIfOsp;
                if (e.status === 'no_band')
                  return Math.abs(whatIfOsp - todaysOsp);
                return 0;
              })();
              const usdTotal = overshootUsd * vol;
              const aedTotal = usdTotal * usdAed;
              const rowAriaId = `whatif-explain-${e.row.id}`;
              return (
                <li
                  key={e.row.id}
                  className="rounded-md border border-border bg-surface text-xs"
                >
                  {/* Row is a clickable container (not a <button> — the
                      Escalate <button> sits inside, and nested buttons
                      are invalid HTML). role + keyboard handlers keep
                      it accessible. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(e.row.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        toggleExpand(e.row.id);
                      }
                    }}
                    aria-expanded={expanded}
                    aria-controls={rowAriaId}
                    className="flex flex-wrap items-center justify-between gap-2 p-2 cursor-pointer hover:bg-surface/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-ink-subtle transition-transform duration-150 ${expanded ? 'rotate-0' : '-rotate-90'}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-ink">{e.row.positionRef}</p>
                      <p className="text-[11px] text-ink-muted">
                        {e.row.counterparty?.nameEn} ·{' '}
                        {humanizeLabel(e.status)} ·{' '}
                        {e.hasClause
                          ? t('financial.tradeMargin.whatIf.clausePresent', {
                              defaultValue: 'Has price-protection clause',
                            })
                          : t('financial.tradeMargin.whatIf.clauseMissing', {
                              defaultValue: 'No price-protection clause',
                            })}
                      </p>
                    </div>
                    <p className="font-mono text-terracotta">
                      {formatAedCompact(String(Math.round(e.compressionAed)))}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEscalate(e.row);
                      }}
                      className="h-8"
                    >
                      <ArrowUpRight className="me-1 h-3 w-3" aria-hidden="true" />
                      {t('financial.tradeMargin.actions.escalate', {
                        defaultValue: 'Escalate',
                      })}
                    </Button>
                  </div>
                  {expanded && (
                    <WhatIfBreakdown
                      id={rowAriaId}
                      status={e.status as 'above_ceiling' | 'below_floor' | 'no_band'}
                      hasClause={e.hasClause}
                      ceilingUsd={ceilingNum}
                      floorUsd={floorNum}
                      whatIfOsp={whatIfOsp}
                      todaysOsp={todaysOsp}
                      volumeBbl={vol}
                      usdAed={usdAed}
                      overshootUsd={overshootUsd}
                      usdTotal={usdTotal}
                      aedTotal={aedTotal}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">
          {t('financial.tradeMargin.whatIf.allWithin', {
            defaultValue:
              'At this OSP, no positions breach their contracted band. Adjust the slider to test other scenarios.',
          })}
        </p>
      )}

      <p className="mt-3 text-[11px] italic text-ink-subtle">
        {t('financial.tradeMargin.whatIf.footnote', {
          defaultValue:
            'Impact estimate assumes a 1:1 $/bbl pass-through from the contracted band edge to AGT trading margin at the chosen OSP. Positions without a clause are listed for amendment because every dollar of OSP movement flows straight through to margin.',
        })}
      </p>

      {/* Hidden helper to keep imports referenced. */}
      <span className="sr-only">{withClause.length}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// E-rev-P — WhatIfBreakdown
// Inline calculation panel rendered under an expanded affected-position
// row. Spells out the math so the AED number isn't a black box.
// ─────────────────────────────────────────────────────────────
function WhatIfBreakdown({
  id,
  status,
  hasClause,
  ceilingUsd,
  floorUsd,
  whatIfOsp,
  todaysOsp,
  volumeBbl,
  usdAed,
  overshootUsd,
  usdTotal,
  aedTotal,
}: {
  id: string;
  status: 'above_ceiling' | 'below_floor' | 'no_band';
  hasClause: boolean;
  ceilingUsd: number | null;
  floorUsd: number | null;
  whatIfOsp: number;
  todaysOsp: number;
  volumeBbl: number;
  usdAed: number;
  overshootUsd: number;
  usdTotal: number;
  aedTotal: number;
}) {
  const { t } = useTranslation();
  const fmtAed = (n: number) =>
    new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      maximumFractionDigits: 0,
    }).format(n);
  const fmtUsd = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  const fmtBbl = (n: number) => new Intl.NumberFormat('en-US').format(n);

  // Headline + per-line labels vary by which side of the band was breached.
  const formulaLabel =
    status === 'above_ceiling'
      ? t('financial.tradeMargin.whatIf.formulaAboveCeiling', {
          defaultValue: '(Benchmark OSP − Ceiling) × Volume × USD→AED',
        })
      : status === 'below_floor'
      ? t('financial.tradeMargin.whatIf.formulaBelowFloor', {
          defaultValue: '(Floor − Benchmark OSP) × Volume × USD→AED',
        })
      : t('financial.tradeMargin.whatIf.formulaNoBand', {
          defaultValue: '|Benchmark move from today| × Volume × USD→AED',
        });

  const overshootLine =
    status === 'above_ceiling' && ceilingUsd != null
      ? `($${whatIfOsp.toFixed(2)} − $${ceilingUsd.toFixed(2)}) = $${overshootUsd.toFixed(2)}/bbl`
      : status === 'below_floor' && floorUsd != null
      ? `($${floorUsd.toFixed(2)} − $${whatIfOsp.toFixed(2)}) = $${overshootUsd.toFixed(2)}/bbl`
      : `|$${whatIfOsp.toFixed(2)} − $${todaysOsp.toFixed(2)}| = $${overshootUsd.toFixed(2)}/bbl`;

  const explainer = (() => {
    if (status === 'above_ceiling') {
      return hasClause
        ? t('financial.tradeMargin.whatIf.explainAboveCeilingClause', {
            defaultValue:
              'Benchmark is above the contracted ceiling. If the buyer invokes the price-review clause and demands a reset to the ceiling, the trader forgoes the overshoot on every barrel lifted at this OSP.',
          })
        : t('financial.tradeMargin.whatIf.explainAboveCeilingNoClause', {
            defaultValue:
              'Benchmark is above the contracted ceiling but there is no clause to invoke — exposure is informational until a clause is added.',
          });
    }
    if (status === 'below_floor') {
      return hasClause
        ? t('financial.tradeMargin.whatIf.explainBelowFloorClause', {
            defaultValue:
              'Benchmark is below the contracted floor. The seller can invoke the floor and recover the shortfall on every barrel — symmetric to the ceiling case.',
          })
        : t('financial.tradeMargin.whatIf.explainBelowFloorNoClause', {
            defaultValue:
              'Benchmark is below the contracted floor but there is no clause — exposure is informational until a clause is added.',
          });
    }
    return t('financial.tradeMargin.whatIf.explainNoBand', {
      defaultValue:
        'No price-protection clause means every $1/bbl of benchmark movement flows directly through to the trader’s margin. The number shown is the gross dollar impact of moving from today’s OSP to the slider value.',
    });
  })();

  return (
    <div
      id={id}
      className="border-t border-border/60 bg-card/40 p-3"
    >
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {t('financial.tradeMargin.whatIf.howCalculated', {
          defaultValue: 'How this is calculated',
        })}
      </p>

      {/* Formula header */}
      <p className="font-mono text-[11px] text-ink">{formulaLabel}</p>

      {/* Step-by-step substitution */}
      <div className="mt-2 space-y-1 font-mono text-[11px] text-ink-muted">
        <p>{overshootLine}</p>
        <p>
          ${overshootUsd.toFixed(2)}/bbl × {fmtBbl(volumeBbl)} bbl × {usdAed.toFixed(2)} AED/USD
        </p>
        <p className="text-ink">
          = {fmtUsd(usdTotal)} = <span className="text-terracotta">{fmtAed(aedTotal)}</span>
        </p>
      </div>

      {/* Plain-English explanation */}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{explainer}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// E-rev-H — BandStatusBadge
// ─────────────────────────────────────────────────────────────
function BandStatusBadge({ status }: { status: BandStatus }) {
  const { t } = useTranslation();
  const map: Record<BandStatus, { cls: string; label: string; defaultLabel: string; icon: 'down' | 'up' | 'minus' | 'alert' | null }> = {
    within_band: {
      cls: 'bg-sage-tint text-sage-ink',
      label: 'financial.tradeMargin.bandStatus.within',
      defaultLabel: 'In band',
      icon: 'minus',
    },
    at_floor: {
      cls: 'bg-amber-tint/60 text-amber-ink',
      label: 'financial.tradeMargin.bandStatus.atFloor',
      defaultLabel: 'At floor',
      icon: 'down',
    },
    at_ceiling: {
      cls: 'bg-amber-tint/60 text-amber-ink',
      label: 'financial.tradeMargin.bandStatus.atCeiling',
      defaultLabel: 'At ceiling',
      icon: 'up',
    },
    below_floor: {
      cls: 'bg-terracotta-tint text-terracotta-ink',
      label: 'financial.tradeMargin.bandStatus.belowFloor',
      defaultLabel: 'Below floor',
      icon: 'down',
    },
    above_ceiling: {
      cls: 'bg-terracotta-tint text-terracotta-ink',
      label: 'financial.tradeMargin.bandStatus.aboveCeiling',
      defaultLabel: 'Above ceiling',
      icon: 'up',
    },
    no_band: {
      cls: 'bg-muted text-ink-muted',
      label: 'financial.tradeMargin.bandStatus.noBand',
      defaultLabel: 'No clause',
      icon: 'alert',
    },
  };
  const m = map[status];
  const Icon =
    m.icon === 'down'
      ? TrendingDown
      : m.icon === 'up'
        ? TrendingUp
        : m.icon === 'alert'
          ? AlertTriangle
          : Minus;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(m.label, { defaultValue: m.defaultLabel })}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// E-rev-H — EscalateBandDialog
// Opens a risk_case assigned to the linked contract's drafter (falls back
// to legal_counsel role when drafter unknown) with the band-breach context
// in the body. Same pattern as Budget Burn's "Escalate to drafter".
// ─────────────────────────────────────────────────────────────
function EscalateBandDialog({
  target,
  onClose,
}: {
  target: TradePositionListItem | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  // E-rev-L — Clause-aware title + body. Two paths:
  //   - Has band/clause → "renegotiate band + revise pricing"
  //   - No band/clause   → "draft amendment to add price-protection clause"
  const noBand = target?.bandStatus === 'no_band';

  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error('No target');
      const { riskCaseService } = await import('@/services/api/risk-case.service');
      const counterpartyName = target.counterparty?.nameEn ?? '';
      const grade = humanizeLabel(target.grade);
      const osp = target.latestBenchmarkUsdPerBbl
        ? `$${parseFloat(target.latestBenchmarkUsdPerBbl).toFixed(2)}`
        : '—';
      const floor =
        target.contractedFloorUsdPerBbl != null
          ? `$${parseFloat(target.contractedFloorUsdPerBbl).toFixed(2)}`
          : 'no floor';
      const ceiling =
        target.contractedCeilingUsdPerBbl != null
          ? `$${parseFloat(target.contractedCeilingUsdPerBbl).toFixed(2)}`
          : 'no ceiling';
      const title = noBand
        ? `Trade position ${target.positionRef} — draft amendment to add price-protection clause`
        : `Trade position ${target.positionRef} — renegotiate band + revise pricing`;
      const body = [
        `Trade position ${target.positionRef} (${grade} sell to ${counterpartyName}, delivery ${target.deliveryMonth?.slice(0, 7)})`,
        '',
        `Pricing basis: ${target.pricingBasis}`,
        `Latest benchmark (OSP today): ${osp}`,
        noBand
          ? `Contracted band: NONE — no floor / no ceiling negotiated`
          : `Contracted band: floor ${floor} → ceiling ${ceiling}`,
        noBand ? '' : `Clause reference: ${target.bandReviewClauseRef ?? 'Price Review Window'}`,
        '',
        noBand
          ? 'Action requested: draft an amendment that adds a price-protection clause (floor + ceiling band + price-review window) so future OSP movement is bounded. Coordinate with legal for clause language; share draft with counterparty before next delivery cycle.'
          : 'Action requested: open negotiations with the counterparty to revise the contracted band and the buyer-premium structure. The current band has been breached by the latest OSP; recommend revisiting the band edges + freight pass-through to restore margin neutrality.',
        reason.trim() ? '' : '',
        reason.trim() ? `Executive note: ${reason.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      return riskCaseService.create({
        contractId: null,
        priority: noBand ? 'high' : 'critical',
        title,
        body,
        assignedRole: 'contract_drafter',
        slaHours: 48,
        metadata: {
          source: 'trade-margin-band-breach',
          tradePositionId: target.id,
          positionRef: target.positionRef,
          bandStatus: target.bandStatus,
          action: noBand ? 'add_price_protection_clause' : 'renegotiate_band_and_pricing',
        },
      });
    },
    onSuccess: () => {
      toast.success(
        t('financial.tradeMargin.actions.escalateSuccess', {
          defaultValue: 'Risk case opened — drafter will be notified.',
        }),
      );
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      setReason('');
      onClose();
    },
    onError: (e) => toast.error(translateApiError(e, t)),
  });

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {noBand
              ? t('financial.tradeMargin.actions.escalateTitleNoClause', {
                  defaultValue: 'Draft amendment — add price-protection clause',
                })
              : t('financial.tradeMargin.actions.escalateTitleClause', {
                  defaultValue: 'Renegotiate band + revise pricing',
                })}
          </DialogTitle>
          <DialogDescription>
            {noBand
              ? t('financial.tradeMargin.actions.escalateDescriptionNoClause', {
                  defaultValue:
                    'Opens a high-priority risk case assigned to the contract drafter to draft an amendment that introduces a price-protection clause (floor / ceiling + price-review window).',
                })
              : t('financial.tradeMargin.actions.escalateDescriptionClause', {
                  defaultValue:
                    'Opens a critical risk case assigned to the contract drafter to renegotiate the existing price-protection band and revise the pricing structure with the counterparty.',
                })}
          </DialogDescription>
        </DialogHeader>
        {target && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-surface p-3 text-xs">
              <p className="font-mono text-ink">{target.positionRef}</p>
              <p className="mt-1 text-ink-muted">
                {target.counterparty?.nameEn} ·{' '}
                {target.deliveryMonth?.slice(0, 7)} ·{' '}
                {humanizeLabel(target.grade)}
              </p>
              <p className="mt-1 text-ink-muted">
                {target.bandStatus === 'no_band'
                  ? t('financial.tradeMargin.actions.escalateContextNoBand', {
                      defaultValue: 'No band negotiated — fully exposed to OSP movement.',
                    })
                  : target.bandStatus === 'below_floor'
                    ? t('financial.tradeMargin.actions.escalateContextBelow', {
                        defaultValue: 'OSP is below the contracted floor.',
                      })
                    : t('financial.tradeMargin.actions.escalateContextAbove', {
                        defaultValue: 'OSP is above the contracted ceiling.',
                      })}
              </p>
              <p className="mt-2 text-[11px] text-ink">
                <span className="font-semibold">
                  {t('financial.tradeMargin.actions.escalateAssigneeLabel', {
                    defaultValue: 'Assign to:',
                  })}
                </span>{' '}
                {t('financial.tradeMargin.actions.escalateAssigneeDrafter', {
                  defaultValue: 'Contract drafter (role)',
                })}
              </p>
            </div>
            <div>
              <label
                htmlFor="tm-escalate-reason"
                className="mb-1 block text-sm font-medium text-ink"
              >
                {t('financial.tradeMargin.actions.escalateReason', {
                  defaultValue: 'Executive note (optional)',
                })}
              </label>
              <textarea
                id="tm-escalate-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={5000}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('financial.tradeMargin.actions.escalateReasonHint', {
                  defaultValue: 'Why are you escalating this?',
                })}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? t('common.submitting', { defaultValue: 'Opening case…' })
                  : t('financial.tradeMargin.actions.escalateConfirm', {
                      defaultValue: 'Open risk case',
                    })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// PositionRow
// ─────────────────────────────────────────────────────────────
function PositionRow({
  row,
  onEscalate,
}: {
  row: TradePositionListItem;
  onEscalate: () => void;
}) {
  const { t } = useTranslation();
  const marginN = row.marginPerBbl ? parseFloat(row.marginPerBbl) : null;
  const marginClass =
    marginN === null
      ? 'text-ink-muted'
      : marginN >= 0
        ? 'text-sage-ink'
        : 'text-terracotta';
  const bandStatus: BandStatus = row.bandStatus ?? 'no_band';
  const needsEscalate =
    bandStatus === 'no_band' ||
    bandStatus === 'below_floor' ||
    bandStatus === 'above_ceiling';

  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-surface/50">
      {/* E-rev-O — Position cell allowed to wrap to two lines. The ref
          itself is preserved (font-medium ink) and the meta row sits below. */}
      <td className="px-3 py-3 align-top">
        <p className="font-medium text-ink">{row.positionRef}</p>
        <p className="text-xs text-ink-muted">
          {t('financial.tradeMargin.row.deliveryLabel', {
            defaultValue: 'Delivery',
          })}{' '}
          {row.deliveryMonth?.slice(0, 7)} ·{' '}
          {row.termOrSpot === 'term'
            ? t('financial.tradeMargin.termOrSpot.termContract', {
                defaultValue: 'Term contract',
              })
            : t('financial.tradeMargin.termOrSpot.spotDeal', {
                defaultValue: 'Spot deal',
              })}
        </p>
      </td>
      {/* E-rev-O — Counterparty allowed to wrap; full names like
          "Singapore Jurong Aromatics Refinery" display end-to-end. */}
      <td className="px-3 py-3 align-top text-sm text-ink-muted">
        {row.counterparty.nameEn}
      </td>
      {/* Volume — single line */}
      <td className="whitespace-nowrap px-3 py-3 text-right align-top font-mono tabular-nums text-sm text-ink">
        {formatVolume(row.volumeBbl)}
      </td>
      {/* Band — compact "$95–$115" (no decimals, narrow dash) */}
      <td className="whitespace-nowrap px-3 py-3 align-top text-sm">
        {row.contractedFloorUsdPerBbl != null && row.contractedCeilingUsdPerBbl != null ? (
          <span className="font-mono text-xs text-ink">
            ${parseFloat(row.contractedFloorUsdPerBbl).toFixed(0)}–$
            {parseFloat(row.contractedCeilingUsdPerBbl).toFixed(0)}
          </span>
        ) : (
          <span className="font-mono text-xs italic text-ink-subtle">
            {t('financial.tradeMargin.bandStatus.noBandShort', { defaultValue: 'no band' })}
          </span>
        )}
      </td>
      {/* OSP today */}
      <td className="whitespace-nowrap px-3 py-3 text-right align-top font-mono tabular-nums text-sm text-ink">
        {row.latestBenchmarkUsdPerBbl != null
          ? `$${parseFloat(row.latestBenchmarkUsdPerBbl).toFixed(2)}`
          : '—'}
      </td>
      <td className={`whitespace-nowrap px-3 py-3 text-right align-top font-mono tabular-nums text-sm ${marginClass}`}>
        {formatUsdPerBbl(row.marginPerBbl)}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right align-top font-mono tabular-nums text-sm text-ink">
        {formatAedCompact(row.totalMarginAed)}
      </td>
      {/* Band-status pill — keep on a single line */}
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <BandStatusBadge status={bandStatus} />
      </td>
      {/* E-rev-O — Actions buttons centered (vertically + horizontally)
          inside the cell. Stack View on top of Escalate; both buttons share
          the same min-width so they read as a tight column. */}
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col items-center justify-center gap-1">
          <Link
            to="/app/financial/trade-margin/$positionId"
            params={{ positionId: String(row.id) }}
            className="inline-flex h-7 w-[88px] items-center justify-center rounded-md px-2 text-xs font-medium text-ink-muted hover:bg-accent hover:text-accent-foreground"
            aria-label={t('financial.tradeMargin.portfolio.viewDetail', {
              ref: row.positionRef,
            })}
          >
            {t('common.view', { defaultValue: 'View' })}
          </Link>
          {needsEscalate && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onEscalate}
              className="h-7 w-[88px] justify-center px-2"
            >
              <ArrowUpRight className="me-1 h-3 w-3" aria-hidden="true" />
              {t('financial.tradeMargin.actions.escalate', {
                defaultValue: 'Escalate',
              })}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// AggregateView — CFO/trading-desk portfolio rollup (AC#5)
// CR-S: augmented with Chart #4 (margin by side) and Chart #5 (by counterparty)
// ─────────────────────────────────────────────────────────────
function AggregateView({
  data,
}: {
  data: MarginAggregateResult;
}) {
  const { t } = useTranslation();

  // Build grouped-bar data for chart #4 (side grouping)
  const sideChartData = useMemo(() => {
    if (data.groupBy !== 'side') return [];
    return data.breakdown.map((b) => ({
      side: b.label,
      key: b.key,
      marginAed: parseFloat(b.marginAed),
    }));
  }, [data]);

  // Build horizontal bar data for chart #5 (counterparty grouping)
  const counterpartyChartData = useMemo(() => {
    if (data.groupBy !== 'counterparty') return [];
    return data.breakdown
      .map((b) => ({
        name: b.label.length > 24 ? b.label.slice(0, 22) + '…' : b.label,
        marginAed: parseFloat(b.marginAed),
      }))
      .sort((a, b) => b.marginAed - a.marginAed)
      .slice(0, 15); // top 15 for readability
  }, [data]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.aggregate.totalMarginAed')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {formatAedCompact(data.totalMarginAed)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.aggregate.totalMarginUsd')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            ${parseFloat(data.totalMarginUsd).toLocaleString('en-US', {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.aggregate.positionCount')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {data.positionCount}
          </p>
        </div>
      </div>

      {/* Chart #4 — Margin by side grouped bar (when groupBy='side') */}
      {data.groupBy === 'side' && sideChartData.length > 0 && (
        <ChartCard
          title={t('financial.tradeMargin.aggregate.charts.bySide.title')}
          subtitle={t('financial.tradeMargin.aggregate.charts.bySide.subtitle')}
          height={280}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sideChartData}
              margin={{ top: 8, right: 20, bottom: 8, left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="side"
                tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatAedCompact(v)}
                tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <SemanticTooltip currencyHint="aed" />
              <Bar dataKey="marginAed" radius={[4, 4, 0, 0]}>
                {sideChartData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.key === 'sell' ? C1 : C2}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Chart #5 — Margin by counterparty horizontal bar (when groupBy='counterparty') */}
      {data.groupBy === 'counterparty' && counterpartyChartData.length > 0 && (
        <ChartCard
          title={t('financial.tradeMargin.aggregate.charts.byCounterparty.title')}
          subtitle={t('financial.tradeMargin.aggregate.charts.byCounterparty.subtitle')}
          height={Math.max(280, counterpartyChartData.length * 32 + 60)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={counterpartyChartData}
              layout="vertical"
              margin={{ top: 8, right: 60, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                tickFormatter={(v: number) => formatAedCompact(v)}
                tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
                tickLine={false}
                axisLine={false}
              />
              <SemanticTooltip currencyHint="aed" />
              <Bar dataKey="marginAed" radius={[0, 4, 4, 0]}>
                {counterpartyChartData.map((_entry, idx) => (
                  <Cell
                    key={idx}
                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Chart #5 for quarter grouping — fallback to table only */}

      {/* Breakdown table */}
      {data.breakdown.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-border bg-card gap-2">
          <TrendingUp className="h-6 w-6 text-ink-subtle" aria-hidden="true" />
          <p className="text-sm text-ink-muted">
            {t('financial.tradeMargin.aggregate.empty')}
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
                  {t('financial.tradeMargin.aggregate.columns.bucket')}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                >
                  {t('financial.tradeMargin.aggregate.columns.marginAed')}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                >
                  {t('financial.tradeMargin.aggregate.columns.marginUsd')}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                >
                  {t('financial.tradeMargin.aggregate.columns.positions')}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted"
                >
                  {t('financial.tradeMargin.aggregate.columns.pct')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {data.breakdown.map((bucket) => {
                const marginN = parseFloat(bucket.marginAed);
                const barPct = Math.min(100, Math.max(0, bucket.pctOfTotal));
                return (
                  <tr
                    key={bucket.key}
                    className="transition-colors hover:bg-surface/50"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {bucket.label}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums ${marginN >= 0 ? 'text-success' : 'text-terracotta'}`}
                    >
                      {formatAedCompact(bucket.marginAed)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-muted">
                      ${parseFloat(bucket.marginUsd).toLocaleString('en-US', {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-muted">
                      {bucket.positionCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface">
                          <div
                            className="h-full rounded-full bg-gold transition-all"
                            style={{ width: `${barPct}%` }}
                            role="presentation"
                          />
                        </div>
                        <span className="min-w-[3rem] text-right text-xs tabular-nums text-ink-muted">
                          {bucket.pctOfTotal.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// R-IL — SortableTh (mirrors Contract Spend Health pattern). Inactive
// headers show a subtle ⇅ so first-time users see the column is sortable.
// ─────────────────────────────────────────────────────────────
function SortableTh({
  children,
  align,
  active,
  dir,
  onClick,
}: {
  children: React.ReactNode;
  align: 'left' | 'right' | 'center';
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  const textAlign =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 py-3 font-mono text-[10px] uppercase tracking-wider ${active ? 'text-ink' : 'text-ink-subtle'} ${textAlign}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex w-full items-center gap-1 hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary ${justify}`}
      >
        {children}
        {active ? (
          <span aria-hidden="true" className="text-ink">{dir === 'asc' ? '▲' : '▼'}</span>
        ) : (
          <span aria-hidden="true" className="text-ink-subtle/60 opacity-60">⇅</span>
        )}
      </button>
    </th>
  );
}
