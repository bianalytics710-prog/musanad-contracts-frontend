/**
 * /app/financial/trade-margin — Trade Margin Positions list (index).
 *
 * CR-O — M21 Financial Intelligence (Trade Margin). Primary persona: finance_treasury.
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
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  RefreshCcw,
  ChevronRight,
  TrendingUp,
  ArrowUpDown,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { financialTradeMarginService } from '@/services/api/financial-trade-margin.service';
import { translateApiError } from '@/lib/translate-api-error';
import { useDebounce } from '@/hooks/useDebounce';
import type {
  TradePositionListItem,
  TradePositionListQuery,
  MarginAggregateQuery,
  TradeSide,
  MarginRecommendation,
} from '@/types/entities/trade-margin.types';

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
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
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
  const [sideFilter, setSideFilter] = useState<TradeSide | ''>('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'positions' | 'aggregate'>(
    'positions',
  );
  const [groupBy, setGroupBy] = useState<
    'counterparty' | 'quarter' | 'side'
  >('side');

  const LIMIT = 50;
  const debouncedSearch = useDebounce(search, 300);

  const positionsParams = useMemo<TradePositionListQuery>(
    () => ({
      page,
      limit: LIMIT,
      side: sideFilter !== '' ? sideFilter : undefined,
      search: debouncedSearch || undefined,
    }),
    [page, sideFilter, debouncedSearch],
  );

  const aggregateParams = useMemo<MarginAggregateQuery>(
    () => ({ groupBy }),
    [groupBy],
  );

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

  const {
    data: aggregateData,
    isLoading: aggregateLoading,
    isError: aggregateError,
    error: aggregateErr,
    refetch: refetchAggregate,
  } = useQuery({
    queryKey: ['trade-margin-aggregate', aggregateParams],
    queryFn: () =>
      financialTradeMarginService.getAggregate(aggregateParams),
    enabled: canRead && activeTab === 'aggregate',
    staleTime: 30_000,
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

  const rows = positionsData?.data ?? [];
  const pagination = positionsData?.pagination;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t('financial.tradeMargin.portfolio.title')}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('financial.tradeMargin.portfolio.subtitle')}
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 rounded-lg border border-border bg-surface p-1"
        role="tablist"
        aria-label={t('financial.tradeMargin.portfolio.tabsLabel')}
      >
        {(['positions', 'aggregate'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
              activeTab === tab
                ? 'bg-card text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t(`financial.tradeMargin.portfolio.tab.${tab}`)}
          </button>
        ))}
      </div>

      {/* ── Positions tab ── */}
      {activeTab === 'positions' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="tm-search"
                className="text-xs font-medium text-ink-muted"
              >
                {t('financial.tradeMargin.filters.searchLabel')}
              </label>
              <input
                id="tm-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t(
                  'financial.tradeMargin.filters.searchPlaceholder',
                )}
                className="h-9 rounded-md border border-border bg-card px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Side filter */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="tm-side"
                className="text-xs font-medium text-ink-muted"
              >
                {t('financial.tradeMargin.filters.sideLabel')}
              </label>
              <select
                id="tm-side"
                value={sideFilter}
                onChange={(e) => {
                  setSideFilter(e.target.value as TradeSide | '');
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border bg-card px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">
                  {t('financial.tradeMargin.filters.sideAll')}
                </option>
                <option value="sell">
                  {t('financial.tradeMargin.side.sell')}
                </option>
                <option value="buy">
                  {t('financial.tradeMargin.side.buy')}
                </option>
              </select>
            </div>
          </div>

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
                <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-surface">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                        >
                          {t('financial.tradeMargin.columns.side')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                        >
                          {t('financial.tradeMargin.columns.position')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                        >
                          {t('financial.tradeMargin.columns.grade')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                        >
                          {t('financial.tradeMargin.columns.counterparty')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                        >
                          {t('financial.tradeMargin.columns.volume')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                        >
                          {t('financial.tradeMargin.columns.pricingBasis')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                        >
                          {t('financial.tradeMargin.columns.marginPerBbl')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                        >
                          {t('financial.tradeMargin.columns.totalMarginAed')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                        >
                          {t('financial.tradeMargin.columns.status')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                        >
                          <span className="sr-only">
                            {t('common.actions')}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {rows.map((row) => (
                        <PositionRow key={row.id} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
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
        </>
      )}

      {/* ── Aggregate tab ── */}
      {activeTab === 'aggregate' && (
        <>
          {/* Group-by selector */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="tm-groupby"
              className="text-xs font-medium text-ink-muted"
            >
              {t('financial.tradeMargin.aggregate.groupByLabel')}
            </label>
            <select
              id="tm-groupby"
              value={groupBy}
              onChange={(e) =>
                setGroupBy(
                  e.target.value as 'counterparty' | 'quarter' | 'side',
                )
              }
              className="h-9 w-48 rounded-md border border-border bg-card px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="side">
                {t('financial.tradeMargin.aggregate.groupBy.side')}
              </option>
              <option value="counterparty">
                {t(
                  'financial.tradeMargin.aggregate.groupBy.counterparty',
                )}
              </option>
              <option value="quarter">
                {t('financial.tradeMargin.aggregate.groupBy.quarter')}
              </option>
            </select>
          </div>

          {/* Loading */}
          {aggregateLoading && (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
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
          {aggregateError && (
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
                  aggregateErr,
                  t,
                  'financial.tradeMargin.errors.fetchFailed',
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refetchAggregate()}
              >
                <RefreshCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {t('common.retry')}
              </Button>
            </div>
          )}

          {/* Aggregate content */}
          {!aggregateLoading && !aggregateError && aggregateData && (
            <AggregateView data={aggregateData} />
          )}
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// PositionRow
// ─────────────────────────────────────────────────────────────
function PositionRow({ row }: { row: TradePositionListItem }) {
  const { t } = useTranslation();
  const marginN = row.marginPerBbl ? parseFloat(row.marginPerBbl) : null;
  const marginClass =
    marginN === null
      ? 'text-ink-muted'
      : marginN >= 0
        ? 'text-success'
        : 'text-terracotta';

  return (
    <tr className="transition-colors hover:bg-surface/50">
      <td className="px-4 py-3">
        <SideBadge side={row.side} />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{row.positionRef}</p>
        <p className="text-xs text-ink-muted">
          {row.deliveryMonth} ·{' '}
          {t(`financial.tradeMargin.termOrSpot.${row.termOrSpot}`, {
            defaultValue: row.termOrSpot,
          })}
        </p>
      </td>
      <td className="px-4 py-3 text-sm text-ink-muted">
        {t(`financial.tradeMargin.grade.${row.grade}`, {
          defaultValue: row.grade,
        })}
      </td>
      <td className="px-4 py-3 text-sm text-ink-muted">
        {row.counterparty.nameEn}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-ink">
        {formatVolume(row.volumeBbl)}
      </td>
      <td className="px-4 py-3 text-sm text-ink-muted">
        {t(`financial.tradeMargin.pricingBasis.${row.pricingBasis}`, {
          defaultValue: row.pricingBasis,
        })}
      </td>
      <td
        className={`px-4 py-3 text-right font-mono tabular-nums text-sm ${marginClass}`}
      >
        {formatUsdPerBbl(row.marginPerBbl)}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-ink">
        {formatAedCompact(row.totalMarginAed)}
        {row.totalMarginUsd && (
          <p className="text-[10px] text-ink-muted">
            ${parseFloat(row.totalMarginUsd).toLocaleString('en-US', {
              maximumFractionDigits: 0,
            })}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={row.status} />
        {row.recommendation && (
          <div className="mt-1">
            <RecommendationBadge rec={row.recommendation} />
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Link
          to="/app/financial/trade-margin/$positionId"
          params={{ positionId: String(row.id) }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t('financial.tradeMargin.portfolio.viewDetail', {
            ref: row.positionRef,
          })}
        >
          {t('financial.tradeMargin.portfolio.viewDetails')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// AggregateView — CFO/trading-desk portfolio rollup (AC#5)
// ─────────────────────────────────────────────────────────────
function AggregateView({
  data,
}: {
  data: import('@/types/entities/trade-margin.types').MarginAggregateResult;
}) {
  const { t } = useTranslation();

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
