/**
 * /app/financial/trade-margin/:positionId — Trade Position detail.
 *
 * CR-O — M21 Financial Intelligence (Trade Margin). Primary persona: finance_treasury.
 * CR-S — Tabbed refactor + 6 recharts visualisations + OSP before/after delta panel.
 *
 * Tabs (useState, NOT nested routes — URLs preserved per demo runbook):
 *   1. Overview          — position header + 4 KPI tiles + metadata
 *   2. Murban Benchmark  — HERO Murban OSP line chart + benchmark-context card
 *   3. Margin Breakdown  — waterfall bar chart + collapsible breakdown table
 *   4. Buy-&-Refine      — (side='buy' only) buy-and-refine economics + bar chart
 *   5. History & Trends  — margin snapshot history line + snapshots table
 *   6. Recompute         — recompute panel + OSP before/after delta panel
 *
 * Charts:
 *   #1 HERO Murban OSP LINE chart (3 series + OPEC+ ReferenceLines + diff subplot)
 *   #2 Margin per-cargo WATERFALL bar chart
 *   #3 Margin recompute history LINE chart (dual-axis)
 *   #6 Buy-and-refine economics VERTICAL BAR (buyer only)
 *   #7 OSP before/after delta panel (pure React, no chart)
 *
 * Standards: A7, C13, C14, D6, D7, T3, T4, T11, T12, WCAG AA, RTL logical classes.
 */
import { useState, useId, useEffect, useMemo, useRef } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
  Label,
  ResponsiveContainer,
} from 'recharts';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { ChartCard, SemanticTooltip } from '@/components/charts';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { financialTradeMarginService } from '@/services/api/financial-trade-margin.service';
import { translateApiError } from '@/lib/translate-api-error';
import { formatDateTime } from '@/utils/datetime';
import { cn } from '@/lib/utils';
import type {
  TradePosition,
  MarginSnapshotHistoryItem,
  MarginRecomputeResult,
  CostComponentItem,
  MarginRecommendation,
  PriceBenchmarkListItem,
} from '@/types/entities/trade-margin.types';

export const Route = createFileRoute(
  '/app/financial/trade-margin/$positionId',
)({
  component: () => (
    <ErrorBoundary>
      <TradeMarginDetailView />
    </ErrorBoundary>
  ),
});

// ─────────────────────────────────────────────────────────────
// Tab identifiers
// ─────────────────────────────────────────────────────────────
type TabId =
  | 'overview'
  | 'murbanBenchmark'
  | 'marginBreakdown'
  | 'buyAndRefine'
  | 'historyTrends'
  | 'recompute';

// ─────────────────────────────────────────────────────────────
// Chart color tokens (C13: oklch(var(--chart-N)), no raw hex)
// ─────────────────────────────────────────────────────────────
const C1 = 'var(--chart-1)'; // gold
const C2 = 'var(--chart-2)'; // sage
const C3 = 'var(--chart-3)'; // slate/muted
const C4 = 'var(--chart-4)'; // terracotta
const C5 = 'var(--chart-5)'; // purple
const SUCCESS = 'var(--success)';
const GOLD_VAR = 'var(--gold)';
const INK_MUTED_VAR = 'var(--ink-muted)';

// ─────────────────────────────────────────────────────────────
// Money formatters (C13: no raw hex)
// ─────────────────────────────────────────────────────────────
function formatAedFull(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `AED ${n.toFixed(0)}`;
  }
}

function formatAedCompact(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
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

function formatUsdPerBblStr(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  return `$${n.toFixed(2)}/bbl`;
}

function deltaSign(raw: string | null | undefined): string {
  if (!raw) return '';
  const n = parseFloat(raw);
  if (isNaN(n) || n === 0) return '';
  return n > 0 ? '+' : '';
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
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colorMap[rec]}`}
    >
      {t(`financial.tradeMargin.recommendation.${rec}`)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// StatusBadge
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
function TradeMarginDetailView() {
  const { t } = useTranslation();
  const { positionId } = Route.useParams();
  const posId = parseInt(positionId, 10);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const tabListRef = useRef<HTMLDivElement>(null);

  const canRead = useAuthStore(selectHasPermission('finance.margin.read'));
  const canManage = useAuthStore(selectHasPermission('finance.trade.manage'));

  const queryClient = useQueryClient();

  const {
    data: position,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['trade-margin-detail', posId],
    queryFn: () => financialTradeMarginService.getPositionDetail(posId),
    enabled: canRead && !isNaN(posId),
    staleTime: 30_000,
  });

  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
  } = useQuery({
    queryKey: ['trade-margin-history', posId],
    queryFn: () =>
      financialTradeMarginService.getSnapshotHistory(posId, 20),
    enabled: canRead && !isNaN(posId),
    staleTime: 30_000,
  });

  // Parallel benchmark fetches for the Murban hero chart
  const murbanQuery = useQuery({
    queryKey: ['price-benchmarks', 'murban_osp', posId],
    queryFn: () =>
      financialTradeMarginService.listBenchmarks({
        benchmarkCode: 'murban_osp',
        from: '2025-02-01',
        to: '2026-12-31',
        limit: 100,
      }),
    enabled: canRead && activeTab === 'murbanBenchmark',
    staleTime: 60_000,
  });

  const brentQuery = useQuery({
    queryKey: ['price-benchmarks', 'brent', posId],
    queryFn: () =>
      financialTradeMarginService.listBenchmarks({
        benchmarkCode: 'brent',
        from: '2025-02-01',
        to: '2026-12-31',
        limit: 100,
      }),
    enabled: canRead && activeTab === 'murbanBenchmark',
    staleTime: 60_000,
  });

  const dubaiQuery = useQuery({
    queryKey: ['price-benchmarks', 'dubai', posId],
    queryFn: () =>
      financialTradeMarginService.listBenchmarks({
        benchmarkCode: 'dubai',
        from: '2025-02-01',
        to: '2026-12-31',
        limit: 100,
      }),
    enabled: canRead && activeTab === 'murbanBenchmark',
    staleTime: 60_000,
  });

  // Tab definitions — Buy-&-Refine only rendered for side='buy'.
  // F55 — Murban Benchmark only rendered when the position is priced on Murban OSP.
  // Showing this tab on a Basra Light spot buy is irrelevant and confusing.
  const TABS: { id: TabId; labelKey: string; hiddenWhen?: boolean }[] = useMemo(
    () => [
      { id: 'overview', labelKey: 'financial.tradeMargin.detail.tabs.overview' },
      {
        id: 'murbanBenchmark',
        labelKey: 'financial.tradeMargin.detail.tabs.murbanBenchmark',
        hiddenWhen: position?.pricingBasis !== 'murban_osp',
      },
      { id: 'marginBreakdown', labelKey: 'financial.tradeMargin.detail.tabs.marginBreakdown' },
      {
        id: 'buyAndRefine',
        labelKey: 'financial.tradeMargin.detail.tabs.buyAndRefine',
        hiddenWhen: position?.side !== 'buy',
      },
      { id: 'historyTrends', labelKey: 'financial.tradeMargin.detail.tabs.historyTrends' },
      { id: 'recompute', labelKey: 'financial.tradeMargin.detail.tabs.recompute' },
    ],
    [position?.side, position?.pricingBasis],
  );

  const visibleTabs = TABS.filter((tab) => !tab.hiddenWhen);

  // Keyboard navigation on tab strip (Arrow Left/Right)
  function handleTabKeyDown(e: React.KeyboardEvent, currentId: TabId) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const idx = visibleTabs.findIndex((t) => t.id === currentId);
    const nextIdx =
      e.key === 'ArrowRight'
        ? (idx + 1) % visibleTabs.length
        : (idx - 1 + visibleTabs.length) % visibleTabs.length;
    const nextId = visibleTabs[nextIdx]?.id;
    if (nextId) {
      setActiveTab(nextId);
      // focus the next button
      const btn = tabListRef.current?.querySelector<HTMLButtonElement>(
        `[data-tab="${nextId}"]`,
      );
      btn?.focus();
    }
    e.preventDefault();
  }

  if (!canRead) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="mx-auto w-full max-w-[1400px] space-y-4 p-6"
        aria-busy="true"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-surface"
            aria-hidden="true"
          />
        ))}
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  if (isError || !position) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6">
        <BackLink />
        <div
          className="mt-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          role="alert"
        >
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-error"
            aria-hidden="true"
          />
          <p className="text-sm text-error">
            {translateApiError(
              error,
              t,
              'financial.tradeMargin.errors.fetchFailed',
            )}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            <RefreshCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const snapshots = historyData?.snapshots ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] space-y-6 p-6"
    >
      <BackLink />

      {/* Position header — always visible */}
      <PositionHeader position={position} />

      {/* Tab strip */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label={t('financial.tradeMargin.detail.tabs.ariaLabel')}
        className="flex flex-wrap gap-1 border-b border-border pb-0"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab={tab.id}
            aria-selected={activeTab === tab.id}
            aria-controls={`tab-panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
            className={cn(
              'rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary',
              activeTab === tab.id
                ? 'border-border bg-card text-ink'
                : 'border-transparent bg-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Overview ────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div
          id="tab-panel-overview"
          role="tabpanel"
          aria-labelledby="tab-overview"
          className="space-y-5"
        >
          {position.latestMargin ? (
            <LatestMarginKpis position={position} />
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-sm text-ink-muted">
                {t('financial.tradeMargin.detail.noMarginYet')}
              </p>
            </div>
          )}
          <PositionMetaGrid position={position} />
        </div>
      )}

      {/* ── TAB 2: Murban Benchmark ─────────────────────────────── */}
      {activeTab === 'murbanBenchmark' && (
        <div
          id="tab-panel-murbanBenchmark"
          role="tabpanel"
          aria-labelledby="tab-murbanBenchmark"
          className="space-y-4"
        >
          <MurbanBenchmarkTab
            murbanData={murbanQuery.data?.data ?? []}
            brentData={brentQuery.data?.data ?? []}
            dubaiData={dubaiQuery.data?.data ?? []}
            isLoading={
              murbanQuery.isLoading || brentQuery.isLoading || dubaiQuery.isLoading
            }
            position={position}
          />
        </div>
      )}

      {/* ── TAB 3: Margin Breakdown ─────────────────────────────── */}
      {activeTab === 'marginBreakdown' && (
        <div
          id="tab-panel-marginBreakdown"
          role="tabpanel"
          aria-labelledby="tab-marginBreakdown"
          className="space-y-4"
        >
          <MarginBreakdownTab position={position} />
        </div>
      )}

      {/* ── TAB 4: Buy-&-Refine (buyer only) ───────────────────── */}
      {activeTab === 'buyAndRefine' && position.side === 'buy' && (
        <div
          id="tab-panel-buyAndRefine"
          role="tabpanel"
          aria-labelledby="tab-buyAndRefine"
          className="space-y-4"
        >
          <BuyAndRefineTab position={position} />
        </div>
      )}

      {/* ── TAB 5: History & Trends ─────────────────────────────── */}
      {activeTab === 'historyTrends' && (
        <div
          id="tab-panel-historyTrends"
          role="tabpanel"
          aria-labelledby="tab-historyTrends"
          className="space-y-4"
        >
          <HistoryTrendsTab
            snapshots={snapshots}
            isLoading={historyLoading}
            isError={historyError}
            side={position.side}
          />
        </div>
      )}

      {/* ── TAB 6: Recompute ────────────────────────────────────── */}
      {activeTab === 'recompute' && (
        <div
          id="tab-panel-recompute"
          role="tabpanel"
          aria-labelledby="tab-recompute"
          className="space-y-4"
        >
          {canManage ? (
            <RecomputeTab
              posId={posId}
              onSuccess={() => {
                void queryClient.invalidateQueries({
                  queryKey: ['trade-margin-detail', posId],
                });
                void queryClient.invalidateQueries({
                  queryKey: ['trade-margin-history', posId],
                });
                void queryClient.invalidateQueries({
                  queryKey: ['trade-margin-positions'],
                });
                void queryClient.invalidateQueries({
                  queryKey: ['trade-margin-aggregate'],
                });
              }}
              position={position}
            />
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-sm text-ink-muted">{t('common.accessDenied')}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// BackLink
// ─────────────────────────────────────────────────────────────
function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/app/financial/trade-margin"
      className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t('financial.tradeMargin.detail.backToPortfolio')}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// PositionHeader — always visible above tab strip
// ─────────────────────────────────────────────────────────────
function PositionHeader({ position }: { position: TradePosition }) {
  const { t, i18n } = useTranslation();
  const isSell = position.side === 'sell';
  // F47 / F58 — locale-conditional render: only show counterparty Arabic when actor locale = ar,
  // and only show English when actor locale = en. Avoid bilingual duplication in either mode.
  const isAr = i18n.language?.startsWith('ar');
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {position.positionRef}
            </h1>
            {/* F46 / F57 — drop `uppercase` class on side badge; t() value
                renders title-case ("Sell" / "Buy") via existing i18n keys. */}
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wider ${
                isSell
                  ? 'border border-gold/30 bg-gold/10 text-gold'
                  : 'border border-sage/30 bg-sage/10 text-sage'
              }`}
            >
              {isSell
                ? t('financial.tradeMargin.side.sell')
                : t('financial.tradeMargin.side.buy')}
            </span>
            <StatusBadge status={position.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {t(`financial.tradeMargin.grade.${position.grade}`, {
              defaultValue: position.grade,
            })}{' '}
            ·{' '}
            {t(`financial.tradeMargin.termOrSpot.${position.termOrSpot}`, {
              defaultValue: position.termOrSpot,
            })}{' '}
            · {t('financial.tradeMargin.detail.delivery')}{' '}
            {position.deliveryMonth}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.detail.counterparty')}
          </p>
          {/* F47 / F58 — locale-conditional: AR if isAr, else EN. Never both. */}
          {isAr && position.counterparty.nameAr ? (
            <p className="font-medium text-ink" dir="rtl">
              {position.counterparty.nameAr}
            </p>
          ) : (
            <p className="font-medium text-ink">
              {position.counterparty.nameEn}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LatestMarginKpis — 4 KPI tiles (Overview tab)
// ─────────────────────────────────────────────────────────────
function LatestMarginKpis({ position }: { position: TradePosition }) {
  const { t } = useTranslation();
  const m = position.latestMargin!;
  const marginN = parseFloat(m.marginPerBbl);
  const marginClass = marginN >= 0 ? 'text-success' : 'text-terracotta';

  return (
    <section
      aria-label={t('financial.tradeMargin.detail.marginKpisLabel')}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-ink-muted">
          {t('financial.tradeMargin.detail.kpis.marginPerBbl')}
        </p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${marginClass}`}>
          {formatUsdPerBblStr(m.marginPerBbl)}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-ink-muted">
          {t('financial.tradeMargin.detail.kpis.totalMarginAed')}
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {formatAedCompact(m.totalMarginAed)}
        </p>
        <p className="text-xs text-ink-muted tabular-nums">
          ${parseFloat(m.totalMarginUsd).toLocaleString('en-US', {
            maximumFractionDigits: 0,
          })}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-ink-muted">
          {t('financial.tradeMargin.detail.kpis.recommendation')}
        </p>
        <div className="mt-2">
          <RecommendationBadge rec={m.recommendation} />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-ink-muted">
          {t('financial.tradeMargin.detail.kpis.lastComputed')}
        </p>
        <p className="mt-1 text-sm font-medium text-ink">
          {formatDateTime(m.latestComputedAt)}
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// PositionMetaGrid — metadata grid (Overview tab)
// ─────────────────────────────────────────────────────────────
function PositionMetaGrid({ position }: { position: TradePosition }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink">
        {t('financial.tradeMargin.detail.overview.metaTitle')}
      </h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 text-sm">
        <div>
          <dt className="text-xs text-ink-muted">
            {t('financial.tradeMargin.detail.volume')}
          </dt>
          <dd className="mt-0.5 font-medium text-ink tabular-nums">
            {parseFloat(position.volumeBbl).toLocaleString('en-US', {
              maximumFractionDigits: 0,
            })}{' '}
            bbl
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">
            {t('financial.tradeMargin.detail.pricingBasis')}
          </dt>
          <dd className="mt-0.5 font-medium text-ink">
            {t(`financial.tradeMargin.pricingBasis.${position.pricingBasis}`, {
              defaultValue: position.pricingBasis,
            })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">
            {t('financial.tradeMargin.detail.delivery')}
          </dt>
          <dd className="mt-0.5 font-medium text-ink">{position.deliveryMonth}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">
            {t('financial.tradeMargin.detail.overview.termOrSpot')}
          </dt>
          <dd className="mt-0.5 font-medium text-ink">
            {t(`financial.tradeMargin.termOrSpot.${position.termOrSpot}`, {
              defaultValue: position.termOrSpot,
            })}
          </dd>
        </div>
        {position.linkedContract && (
          <div>
            <dt className="text-xs text-ink-muted">
              {t('financial.tradeMargin.detail.linkedContract')}
            </dt>
            <dd className="mt-0.5 font-medium text-ink">
              {position.linkedContract.contractNumber}
            </dd>
          </div>
        )}
        {position.notes && (
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <dt className="text-xs text-ink-muted">
              {t('financial.tradeMargin.detail.overview.notes')}
            </dt>
            <dd className="mt-0.5 text-sm text-ink">{position.notes}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO CHART: Murban Benchmark Tab — Chart #1
// ─────────────────────────────────────────────────────────────

interface MergedBenchmarkRow {
  priceDate: string; // YYYY-MM
  murban?: number;
  brent?: number;
  dubai?: number;
}

function mergeBenchmarkSeries(
  murban: PriceBenchmarkListItem[],
  brent: PriceBenchmarkListItem[],
  dubai: PriceBenchmarkListItem[],
): MergedBenchmarkRow[] {
  const map = new Map<string, MergedBenchmarkRow>();

  function ingest(
    items: PriceBenchmarkListItem[],
    key: 'murban' | 'brent' | 'dubai',
  ) {
    for (const item of items) {
      const ym = item.priceDate.slice(0, 7); // YYYY-MM
      const val = parseFloat(item.priceValue);
      if (!isNaN(val)) {
        if (!map.has(ym)) map.set(ym, { priceDate: ym });
        const row = map.get(ym)!;
        row[key] = val;
      }
    }
  }

  ingest(murban, 'murban');
  ingest(brent, 'brent');
  ingest(dubai, 'dubai');

  return Array.from(map.values()).sort((a, b) =>
    a.priceDate.localeCompare(b.priceDate),
  );
}

interface DiffRow {
  priceDate: string;
  diff: number;
}

function computeDiff(merged: MergedBenchmarkRow[]): DiffRow[] {
  return merged
    .filter((r) => r.murban != null && r.dubai != null)
    .map((r) => ({
      priceDate: r.priceDate,
      diff: r.murban! - r.dubai!,
    }));
}

function MurbanBenchmarkTab({
  murbanData,
  brentData,
  dubaiData,
  isLoading,
  position,
}: {
  murbanData: PriceBenchmarkListItem[];
  brentData: PriceBenchmarkListItem[];
  dubaiData: PriceBenchmarkListItem[];
  isLoading: boolean;
  position: TradePosition;
}) {
  const { t } = useTranslation();

  const merged = useMemo(
    () => mergeBenchmarkSeries(murbanData, brentData, dubaiData),
    [murbanData, brentData, dubaiData],
  );

  const diffData = useMemo(() => computeDiff(merged), [merged]);

  const isEmpty = !isLoading && merged.length === 0;

  // OPEC+ reference lines — annotated dates with i18n labels
  const opecEvents = [
    { x: '2025-06', labelKey: 'financial.tradeMargin.charts.murbanBenchmark.opec.ext_cuts' },
    { x: '2025-12', labelKey: 'financial.tradeMargin.charts.murbanBenchmark.opec.plus500' },
    { x: '2026-04', labelKey: 'financial.tradeMargin.charts.murbanBenchmark.opec.pause' },
    { x: '2026-09', labelKey: 'financial.tradeMargin.charts.murbanBenchmark.opec.review' },
  ];

  // Compute Y domain for the main chart with a small margin
  const yValues = merged.flatMap((r) =>
    [r.murban, r.brent, r.dubai].filter((v): v is number => v != null),
  );
  const yMin = yValues.length > 0 ? Math.floor(Math.min(...yValues) * 0.97) : 'auto';
  const yMax = yValues.length > 0 ? Math.ceil(Math.max(...yValues) * 1.03) : 'auto';

  return (
    <>
      {/* Hero chart — Murban OSP time series */}
      <ChartCard
        title={t('financial.tradeMargin.charts.murbanBenchmark.title')}
        subtitle={t('financial.tradeMargin.charts.murbanBenchmark.subtitle')}
        loading={isLoading}
        empty={isEmpty}
        emptyLabel={t('financial.tradeMargin.charts.murbanBenchmark.empty')}
        height={360}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={merged}
            margin={{ top: 16, right: 20, bottom: 8, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="priceDate"
              tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              domain={[yMin, yMax]}
              tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            {/* F49 — explicit formatter with " " margin so legend items render
                with visible spacing AND innerText extraction preserves it
                ("Brent · Dubai · Murban OSP" not "BrentDubaiMurban OSP"). */}
            <Legend
              verticalAlign="top"
              align="right"
              iconType="line"
              wrapperStyle={{ fontSize: 11, paddingBottom: 4 }}
              formatter={(value: string) => (
                <span style={{ marginRight: 12, color: 'var(--ink-muted)' }}>{value}</span>
              )}
            />
            <SemanticTooltip currencyHint="usd-per-bbl" />

            {/* OPEC+ ReferenceLines */}
            {opecEvents.map((ev) => (
              <ReferenceLine
                key={ev.x}
                x={ev.x}
                stroke={GOLD_VAR}
                strokeDasharray="3 3"
                strokeWidth={1}
              >
                <Label
                  value={t(ev.labelKey)}
                  position="insideTopRight"
                  style={{
                    fontSize: 10,
                    fill: 'var(--gold)',
                    fontWeight: 500,
                  }}
                  angle={-90}
                  offset={4}
                />
              </ReferenceLine>
            ))}

            {/* Brent (dashed, secondary) */}
            <Line
              type="monotone"
              dataKey="brent"
              name={t('financial.tradeMargin.charts.murbanBenchmark.series.brent')}
              stroke={INK_MUTED_VAR}
              strokeWidth={1.5}
              strokeDasharray="6 6"
              dot={false}
              connectNulls
            />
            {/* Dubai (dashed, secondary) */}
            <Line
              type="monotone"
              dataKey="dubai"
              name={t('financial.tradeMargin.charts.murbanBenchmark.series.dubai')}
              stroke={C3}
              strokeWidth={1.5}
              strokeDasharray="2 4"
              dot={false}
              connectNulls
            />
            {/* Murban (solid, primary hero line) */}
            <Line
              type="monotone"
              dataKey="murban"
              name={t('financial.tradeMargin.charts.murbanBenchmark.series.murban')}
              stroke={C1}
              strokeWidth={2.5}
              dot={{ r: 3, fill: C1 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Murban–Dubai differential subplot */}
      <ChartCard
        title={t('financial.tradeMargin.charts.murbanDubaiDifferential.title')}
        loading={isLoading}
        empty={!isLoading && diffData.length === 0}
        emptyLabel={t('financial.tradeMargin.charts.murbanDubaiDifferential.empty')}
        height={140}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={diffData}
            margin={{ top: 8, right: 20, bottom: 4, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="priceDate"
              tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => `$${v.toFixed(1)}`}
              tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <SemanticTooltip currencyHint="usd-per-bbl" />
            {/* Zero reference line */}
            <ReferenceLine
              y={0}
              stroke={INK_MUTED_VAR}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <Line
              type="monotone"
              dataKey="diff"
              name={t('financial.tradeMargin.charts.murbanDubaiDifferential.title')}
              stroke={C2}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Benchmark context card */}
      <BenchmarkContextCard position={position} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// BenchmarkContextCard — benchmark context info
// ─────────────────────────────────────────────────────────────
function BenchmarkContextCard({ position }: { position: TradePosition }) {
  const { t } = useTranslation();
  const lm = position.latestMargin;
  if (!lm) return null;

  return (
    <section
      aria-label={t('financial.tradeMargin.detail.benchmark.sectionLabel')}
      className="rounded-lg border border-gold/20 bg-gold/5 p-5"
    >
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-gold" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">
          {t('financial.tradeMargin.detail.benchmark.title')}
        </h2>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {t('financial.tradeMargin.detail.benchmark.subtitle', {
          basis: t(
            `financial.tradeMargin.pricingBasis.${position.pricingBasis}`,
            { defaultValue: position.pricingBasis },
          ),
        })}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.detail.benchmark.marginPerBbl')}
          </p>
          <p
            className={`mt-0.5 text-lg font-semibold tabular-nums ${
              parseFloat(lm.marginPerBbl) >= 0
                ? 'text-success'
                : 'text-terracotta'
            }`}
          >
            {formatUsdPerBblStr(lm.marginPerBbl)}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.detail.benchmark.totalMargin')}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
            {formatAedFull(lm.totalMarginAed)}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">
            {t('financial.tradeMargin.detail.benchmark.lastComputed')}
          </p>
          <p className="mt-0.5 text-sm text-ink">
            {formatDateTime(lm.latestComputedAt)}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// CHART #2: Margin Breakdown Tab — Waterfall
// ─────────────────────────────────────────────────────────────

interface WaterfallRow {
  label: string;
  pad: number;
  value: number;
  isStart: boolean;
  isEnd: boolean;
  isCost: boolean;
}

function buildWaterfallData(
  components: CostComponentItem[],
  marginPerBbl: string | undefined,
): WaterfallRow[] {
  const revenues = components.filter((c) => c.isRevenue);
  const costs = components.filter((c) => !c.isRevenue);
  const margin = marginPerBbl ? parseFloat(marginPerBbl) : NaN;
  const costTotal = costs.reduce((s, c) => s + parseFloat(c.amountUsdPerBbl), 0);

  // Revenue: prefer the explicit revenue components (buyer: downstream_sale).
  // For sellers there is no isRevenue=true component — the "revenue" is the
  // benchmark price (e.g. Murban OSP). Derive it from marginPerBbl + sum(costs)
  // since margin = revenue - costs.
  let revTotal: number;
  let revLabel: string;
  if (revenues.length > 0) {
    revTotal = revenues.reduce((s, c) => s + parseFloat(c.amountUsdPerBbl), 0);
    revLabel = revenues[0]?.componentType ?? 'revenue';
  } else if (!isNaN(margin) && costs.length > 0) {
    revTotal = margin + costTotal;
    revLabel = 'benchmark_price';
  } else {
    return [];
  }

  const rows: WaterfallRow[] = [];
  let runningBase = 0;

  // Start — Revenue (OSP or downstream sale)
  rows.push({
    label: revLabel,
    pad: 0,
    value: revTotal,
    isStart: true,
    isEnd: false,
    isCost: false,
  });
  runningBase = revTotal;

  // Cost components
  for (const cost of costs) {
    const val = parseFloat(cost.amountUsdPerBbl);
    const newBase = runningBase - val;
    rows.push({
      label: cost.componentType,
      pad: newBase < runningBase ? newBase : runningBase,
      value: val,
      isStart: false,
      isEnd: false,
      isCost: true,
    });
    runningBase = newBase;
  }

  // End — Net margin
  const netMarginN = marginPerBbl ? parseFloat(marginPerBbl) : runningBase;
  rows.push({
    label: 'net_margin',
    pad: Math.min(0, netMarginN),
    value: Math.abs(netMarginN),
    isStart: false,
    isEnd: true,
    isCost: netMarginN < 0,
  });

  return rows;
}

function MarginBreakdownTab({ position }: { position: TradePosition }) {
  const { t } = useTranslation();
  const [showTable, setShowTable] = useState(false);

  const components = position.costComponents;
  const waterfallData = useMemo(
    () =>
      buildWaterfallData(
        components,
        position.latestMargin?.marginPerBbl,
      ),
    [components, position.latestMargin?.marginPerBbl],
  );

  const isEmpty = waterfallData.length === 0;
  const revenues = components.filter((c) => c.isRevenue);
  const costs = components.filter((c) => !c.isRevenue);

  return (
    <>
      {/* Chart #2 — Waterfall bar chart */}
      <ChartCard
        title={t('financial.tradeMargin.charts.marginWaterfall.title')}
        subtitle={t('financial.tradeMargin.charts.marginWaterfall.subtitle')}
        empty={isEmpty}
        emptyLabel={t('financial.tradeMargin.detail.breakdown.empty')}
        height={280}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={waterfallData}
            margin={{ top: 8, right: 20, bottom: 8, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tickFormatter={(label: string) =>
                t(
                  `financial.tradeMargin.componentType.${label}`,
                  { defaultValue: label },
                )
              }
              tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <SemanticTooltip
              currencyHint="usd-per-bbl"
              formatter={(value, name) => {
                const num = typeof value === 'number' ? value : parseFloat(String(value));
                if (name === 'pad') return ['', ''];
                return [`$${num.toFixed(2)}/bbl`, ''];
              }}
            />
            {/* Invisible padding bar (floats the visible bar) */}
            <Bar dataKey="pad" stackId="wf" fill="transparent" />
            {/* Visible colored bar */}
            <Bar dataKey="value" stackId="wf" radius={[2, 2, 0, 0]}>
              {waterfallData.map((row, idx) => {
                let fillColor = C4; // default: terracotta (cost)
                if (row.isStart) fillColor = SUCCESS; // revenue: green
                if (row.isEnd)
                  fillColor = row.isCost ? C4 : SUCCESS;
                return <Cell key={idx} fill={fillColor} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Collapsible table toggle */}
      <div className="rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-ink hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
          aria-expanded={showTable}
        >
          <span>
            {showTable
              ? t('financial.tradeMargin.charts.marginWaterfall.hideTable')
              : t('financial.tradeMargin.charts.marginWaterfall.showTable')}
          </span>
          {showTable ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        {showTable && (
          <div className="overflow-x-auto border-t border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                  >
                    {t('financial.tradeMargin.detail.breakdown.columns.component')}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                  >
                    {t('financial.tradeMargin.detail.breakdown.columns.type')}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                  >
                    {t('financial.tradeMargin.detail.breakdown.columns.usdPerBbl')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {revenues.map((c) => (
                  <ComponentRow key={c.id} component={c} isRevenue={true} />
                ))}
                {costs.map((c) => (
                  <ComponentRow key={c.id} component={c} isRevenue={false} />
                ))}
                {costs.length > 0 && (
                  <tr className="bg-surface">
                    <td
                      colSpan={2}
                      className="px-4 py-2.5 text-xs font-semibold uppercase text-ink-muted"
                    >
                      {t('financial.tradeMargin.detail.breakdown.totalCost')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sm font-semibold text-terracotta">
                      -$
                      {costs
                        .reduce((s, c) => s + parseFloat(c.amountUsdPerBbl), 0)
                        .toFixed(2)}
                      /bbl
                    </td>
                  </tr>
                )}
                {position.latestMargin && (
                  <tr className="border-t-2 border-border bg-surface/80">
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-sm font-semibold text-ink"
                    >
                      {t('financial.tradeMargin.detail.breakdown.netMargin')}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums text-sm font-bold ${
                        parseFloat(position.latestMargin.marginPerBbl) >= 0
                          ? 'text-success'
                          : 'text-terracotta'
                      }`}
                    >
                      {formatUsdPerBblStr(position.latestMargin.marginPerBbl)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function ComponentRow({
  component,
  isRevenue,
}: {
  component: CostComponentItem;
  isRevenue: boolean;
}) {
  const { t } = useTranslation();
  const n = parseFloat(component.amountUsdPerBbl);
  return (
    <tr className="transition-colors hover:bg-surface/50">
      <td className="px-4 py-2.5 text-sm text-ink">
        {t(`financial.tradeMargin.componentType.${component.componentType}`, {
          defaultValue: component.componentType,
        })}
      </td>
      <td className="px-4 py-2.5">
        {isRevenue ? (
          <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
            {t('financial.tradeMargin.detail.breakdown.revenueLabel')}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-terracotta/30 bg-terracotta/10 px-1.5 py-0.5 text-[10px] font-medium text-terracotta">
            {t('financial.tradeMargin.detail.breakdown.costLabel')}
          </span>
        )}
      </td>
      <td
        className={`px-4 py-2.5 text-right font-mono tabular-nums text-sm ${
          isRevenue ? 'text-success' : 'text-terracotta'
        }`}
      >
        {isRevenue ? '+' : '-'}${Math.abs(n).toFixed(2)}/bbl
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// CHART #6: Buy-and-Refine Tab (buyer only)
// ─────────────────────────────────────────────────────────────
function BuyAndRefineTab({ position }: { position: TradePosition }) {
  const { t } = useTranslation();
  const lm = position.latestMargin;
  const components = position.costComponents;

  const revenues = components.filter((c) => c.isRevenue);
  const costs = components.filter((c) => !c.isRevenue);

  const totalRevenueN = revenues.reduce(
    (s, c) => s + parseFloat(c.amountUsdPerBbl),
    0,
  );
  const totalCostN = costs.reduce(
    (s, c) => s + parseFloat(c.amountUsdPerBbl),
    0,
  );

  // Build chart data — one grouped bar per component
  const chartData = useMemo(() => {
    const costsByType: Record<string, number> = {};
    for (const c of costs) {
      costsByType[c.componentType] =
        (costsByType[c.componentType] ?? 0) + parseFloat(c.amountUsdPerBbl);
    }
    const revByType: Record<string, number> = {};
    for (const r of revenues) {
      revByType[r.componentType] =
        (revByType[r.componentType] ?? 0) + parseFloat(r.amountUsdPerBbl);
    }

    return [
      {
        label: position.positionRef,
        ...costsByType,
        ...revByType,
      },
    ];
  }, [costs, revenues, position.positionRef]);

  // Unique component types for bars
  const costTypes = [...new Set(costs.map((c) => c.componentType))];
  const revTypes = [...new Set(revenues.map((r) => r.componentType))];

  const costColors = [C4, C5, C3, C1];
  const revColor = SUCCESS;

  const isEmpty = components.length === 0;

  return (
    <>
      {/* Chart #6 — Vertical grouped bar */}
      <ChartCard
        title={t('financial.tradeMargin.charts.buyAndRefine.title')}
        subtitle={t('financial.tradeMargin.charts.buyAndRefine.subtitle')}
        empty={isEmpty}
        emptyLabel={t('financial.tradeMargin.detail.breakdown.empty')}
        height={240}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 20, bottom: 8, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            {/* F59 — Buy & Refine waterfall legend with explicit spacing. */}
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ fontSize: 10 }}
              formatter={(value: string) => (
                <span style={{ marginRight: 10, color: 'var(--ink-muted)' }}>{value}</span>
              )}
            />
            <SemanticTooltip currencyHint="usd-per-bbl" />
            {costTypes.map((type, idx) => (
              <Bar
                key={type}
                dataKey={type}
                name={t(`financial.tradeMargin.componentType.${type}`, {
                  defaultValue: type,
                })}
                fill={costColors[idx % costColors.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
            {revTypes.map((type) => (
              <Bar
                key={type}
                dataKey={type}
                name={t(`financial.tradeMargin.componentType.${type}`, {
                  defaultValue: type,
                })}
                fill={revColor}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Buy-and-refine economics summary */}
      <section
        aria-label={t('financial.tradeMargin.detail.buyAndRefine.sectionLabel')}
        className="rounded-lg border border-sage/20 bg-sage/5 p-5"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-sage" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">
            {t('financial.tradeMargin.detail.buyAndRefine.title')}
          </h2>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          {t('financial.tradeMargin.detail.buyAndRefine.subtitle')}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-ink-muted">
              {t('financial.tradeMargin.detail.buyAndRefine.downstreamRevenue')}
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-success">
              +${totalRevenueN.toFixed(2)}/bbl
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-ink-muted">
              {t('financial.tradeMargin.detail.buyAndRefine.totalInputCost')}
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-terracotta">
              -${totalCostN.toFixed(2)}/bbl
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-ink-muted">
              {t('financial.tradeMargin.detail.buyAndRefine.projectedMargin')}
            </p>
            <p
              className={`mt-0.5 text-base font-semibold tabular-nums ${
                lm && parseFloat(lm.marginPerBbl) >= 0
                  ? 'text-success'
                  : 'text-terracotta'
              }`}
            >
              {lm ? formatUsdPerBblStr(lm.marginPerBbl) : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-ink-muted">
              {t('financial.tradeMargin.detail.buyAndRefine.action')}
            </p>
            <div className="mt-1.5">
              <RecommendationBadge rec={lm?.recommendation} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// CHART #3: History & Trends Tab — Dual-axis line chart
// ─────────────────────────────────────────────────────────────
function HistoryTrendsTab({
  snapshots,
  isLoading,
  isError,
  side,
}: {
  snapshots: MarginSnapshotHistoryItem[];
  isLoading: boolean;
  isError: boolean;
  side: string;
}) {
  const { t } = useTranslation();

  // Find first price_change-triggered snapshot for ReferenceLine
  const priceChangeSnap = snapshots.find(
    (s) => s.triggeredBy === 'price_change',
  );

  // Chart data — keep ASC order; parse numeric fields
  const chartData = useMemo(
    () =>
      snapshots.map((s) => ({
        computedAt: s.computedAt.slice(0, 16).replace('T', ' '), // short display
        computedAtFull: s.computedAt,
        marginPerBbl: s.marginPerBbl ? parseFloat(s.marginPerBbl) : null,
        benchmarkPriceUsed: s.benchmarkPriceUsed
          ? parseFloat(s.benchmarkPriceUsed)
          : null,
      })),
    [snapshots],
  );

  const isEmpty = !isLoading && !isError && snapshots.length === 0;

  return (
    <>
      {/* Chart #3 — Recompute history dual-axis line */}
      <ChartCard
        title={t('financial.tradeMargin.charts.recomputeHistory.title')}
        subtitle={t('financial.tradeMargin.charts.recomputeHistory.subtitle')}
        loading={isLoading}
        empty={isEmpty}
        emptyLabel={t('financial.tradeMargin.detail.history.empty')}
        height={280}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 16, right: 60, bottom: 8, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="computedAt"
              tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              /* F54 — drop decimal precision on whole-dollar Y-axis ticks
                 ($30 not $30.0). Tooltip retains 2-decimal precision. */
              tickFormatter={(v: number) => `$${Math.round(v)}`}
              tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            {/* F53 — recompute history legend with explicit spacing. */}
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ fontSize: 11, paddingBottom: 4 }}
              formatter={(value: string) => (
                <span style={{ marginRight: 12, color: 'var(--ink-muted)' }}>{value}</span>
              )}
            />
            <SemanticTooltip currencyHint="usd-per-bbl" />

            {/* OSP-drop ReferenceLine */}
            {priceChangeSnap && (
              <ReferenceLine
                yAxisId="left"
                x={priceChangeSnap.computedAt
                  .slice(0, 16)
                  .replace('T', ' ')}
                stroke={GOLD_VAR}
                strokeDasharray="3 3"
                strokeWidth={1}
              >
                <Label
                  value={t(
                    'financial.tradeMargin.charts.recomputeHistory.refLine.ospChange',
                  )}
                  position="insideTopLeft"
                  style={{ fontSize: 10, fill: 'var(--gold)' }}
                />
              </ReferenceLine>
            )}

            {/* Margin per bbl (left axis) */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="marginPerBbl"
              name={t(
                'financial.tradeMargin.charts.recomputeHistory.series.margin',
              )}
              stroke={C1}
              strokeWidth={2.5}
              dot={{ r: 4, fill: C1 }}
              activeDot={{ r: 6 }}
              connectNulls
            />

            {/* Benchmark OSP at compute time (right axis) — seller only */}
            {side === 'sell' && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="benchmarkPriceUsed"
                name={t(
                  'financial.tradeMargin.charts.recomputeHistory.series.osp',
                )}
                stroke={C3}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Error */}
      {isError && (
        <p className="text-sm text-error" role="alert">
          {t('financial.tradeMargin.detail.history.fetchError')}
        </p>
      )}

      {/* Snapshots table */}
      {!isLoading && !isError && snapshots.length > 0 && (
        <section
          aria-label={t('financial.tradeMargin.detail.history.sectionLabel')}
          className="rounded-lg border border-border bg-card p-5"
        >
          <h2 className="mb-4 text-sm font-semibold text-ink">
            {t('financial.tradeMargin.detail.history.title')}
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                  >
                    {t('financial.tradeMargin.detail.history.columns.computed')}
                  </th>
                  {side === 'sell' && (
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                    >
                      {t('financial.tradeMargin.detail.history.columns.ospUsed')}
                    </th>
                  )}
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                  >
                    {t('financial.tradeMargin.detail.history.columns.marginPerBbl')}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                  >
                    {t('financial.tradeMargin.detail.history.columns.totalAed')}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                  >
                    {t('financial.tradeMargin.detail.history.columns.trigger')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...snapshots].reverse().map((snap) => {
                  const mN = parseFloat(snap.marginPerBbl);
                  const mClass = mN >= 0 ? 'text-success' : 'text-terracotta';
                  return (
                    <tr
                      key={snap.marginSnapshotId}
                      className="transition-colors hover:bg-surface/50"
                    >
                      <td className="px-4 py-2.5 text-sm text-ink-muted">
                        {formatDateTime(snap.computedAt)}
                      </td>
                      {side === 'sell' && (
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sm text-ink">
                          {snap.benchmarkPriceUsed
                            ? `$${parseFloat(snap.benchmarkPriceUsed).toFixed(2)}`
                            : '—'}
                        </td>
                      )}
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular-nums text-sm ${mClass}`}
                      >
                        {formatUsdPerBblStr(snap.marginPerBbl)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sm text-ink">
                        {formatAedCompact(snap.totalMarginAed)}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-ink-muted">
                        {t(
                          `financial.tradeMargin.triggeredBy.${snap.triggeredBy}`,
                          { defaultValue: snap.triggeredBy },
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT #7: Recompute Tab — panel + OSP before/after delta
// ─────────────────────────────────────────────────────────────

interface OspDelta {
  before: { osp: string; marginAed: string };
  after: { osp: string; marginAed: string };
  deltaAed: string;
}

function RecomputeTab({
  posId,
  onSuccess,
  position,
}: {
  posId: number;
  onSuccess: () => void;
  position: TradePosition;
}) {
  const { t } = useTranslation();
  const inputId = useId();

  const [newOsp, setNewOsp] = useState('');
  const [lastResult, setLastResult] =
    useState<MarginRecomputeResult | null>(null);
  const [ospDelta, setOspDelta] = useState<OspDelta | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear delta panel after 30s
  useEffect(() => {
    if (ospDelta) {
      clearTimerRef.current = setTimeout(() => setOspDelta(null), 30_000);
    }
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [ospDelta]);

  const recomputeMutation = useMutation({
    mutationFn: () =>
      financialTradeMarginService.recomputeByPrice({
        benchmarkCode: 'murban_osp',
        newPrice: newOsp,
      }),
    onSuccess: (result) => {
      // Estimate "before OSP" from position's last benchmark — best available
      const beforeOsp =
        position.latestMargin
          ? position.latestMargin.marginPerBbl // use current margin as proxy for current OSP display
          : '0';

      setOspDelta({
        before: {
          osp: beforeOsp,
          marginAed: result.priorAggregateMarginAed,
        },
        after: {
          osp: result.newPrice,
          marginAed: result.newAggregateMarginAed,
        },
        deltaAed: result.deltaAed,
      });

      setLastResult(result);
      onSuccess();
      const deltaAed = parseFloat(result.deltaAed);
      const dSign = deltaAed >= 0 ? '+' : '';
      toast.success(
        t('financial.tradeMargin.recompute.successToast', {
          count: result.positionsRecomputed,
          delta: `${dSign}${formatAedCompact(result.deltaAed)}`,
        }),
      );
    },
    onError: (err: Error) => {
      toast.error(
        err.message || t('financial.tradeMargin.recompute.errorToast'),
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(newOsp);
    if (isNaN(v) || v < 0) {
      toast.error(t('financial.tradeMargin.recompute.invalidPrice'));
      return;
    }
    recomputeMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* Recompute form */}
      <section
        aria-label={t('financial.tradeMargin.recompute.sectionLabel')}
        className="rounded-lg border border-gold/30 bg-gold/5 p-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-gold" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">
            {t('financial.tradeMargin.recompute.title')}
          </h2>
        </div>
        <p className="mb-4 text-xs text-ink-muted">
          {t('financial.tradeMargin.recompute.subtitle')}
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor={inputId}
              className="text-xs font-medium text-ink-muted"
            >
              {t('financial.tradeMargin.recompute.ospLabel')}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-ink-muted">
                $
              </span>
              <input
                id={inputId}
                type="number"
                min="0"
                step="0.01"
                value={newOsp}
                onChange={(e) => setNewOsp(e.target.value)}
                placeholder={t('financial.tradeMargin.recompute.ospPlaceholder')}
                className="h-9 rounded-md border border-border bg-card ps-7 pe-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary w-36"
                aria-describedby={`${inputId}-hint`}
              />
            </div>
            <p id={`${inputId}-hint`} className="text-[11px] text-ink-subtle">
              {t('financial.tradeMargin.recompute.ospHint')}
            </p>
          </div>
          <Button
            type="submit"
            disabled={!newOsp || recomputeMutation.isPending}
            className="h-9"
          >
            {recomputeMutation.isPending ? (
              <>
                <RefreshCcw
                  className="me-1.5 h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
                {t('financial.tradeMargin.recompute.computing')}
              </>
            ) : (
              t('financial.tradeMargin.recompute.button')
            )}
          </Button>
        </form>

        {/* Last recompute result summary */}
        {lastResult && (
          <div
            className="mt-4 rounded-lg border border-border bg-card p-4 text-sm"
            aria-live="polite"
          >
            <p className="font-medium text-ink">
              {t('financial.tradeMargin.recompute.resultTitle')}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
              <div>
                <span className="text-ink-muted">
                  {t('financial.tradeMargin.recompute.result.positionsRecomputed')}
                </span>
                <p className="font-semibold text-ink">
                  {lastResult.positionsRecomputed}
                </p>
              </div>
              <div>
                <span className="text-ink-muted">
                  {t('financial.tradeMargin.recompute.result.newPrice')}
                </span>
                <p className="font-semibold text-ink">
                  ${parseFloat(lastResult.newPrice).toFixed(2)}/bbl
                </p>
              </div>
              <div>
                <span className="text-ink-muted">
                  {t('financial.tradeMargin.recompute.result.deltaAed')}
                </span>
                <p
                  className={`font-semibold tabular-nums ${
                    parseFloat(lastResult.deltaAed) >= 0
                      ? 'text-success'
                      : 'text-terracotta'
                  }`}
                >
                  {deltaSign(lastResult.deltaAed)}
                  {formatAedCompact(lastResult.deltaAed)}
                </p>
              </div>
              <div>
                <span className="text-ink-muted">
                  {t('financial.tradeMargin.recompute.result.deltaUsd')}
                </span>
                <p
                  className={`font-semibold tabular-nums ${
                    parseFloat(lastResult.deltaUsd) >= 0
                      ? 'text-success'
                      : 'text-terracotta'
                  }`}
                >
                  {deltaSign(lastResult.deltaUsd)}$
                  {Math.abs(parseFloat(lastResult.deltaUsd)).toLocaleString(
                    'en-US',
                    { maximumFractionDigits: 0 },
                  )}
                </p>
              </div>
            </div>
            {parseFloat(lastResult.deltaAed) < 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-2">
                <TrendingDown
                  className="h-4 w-4 shrink-0 text-terracotta"
                  aria-hidden="true"
                />
                <p className="text-xs text-terracotta">
                  {t('financial.tradeMargin.recompute.compressionWarning', {
                    delta: formatAedCompact(lastResult.deltaAed),
                  })}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Component #7: OSP before/after delta panel */}
      {ospDelta && <OspDeltaPanel delta={ospDelta} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OspDeltaPanel — Component #7
// ─────────────────────────────────────────────────────────────
function OspDeltaPanel({ delta }: { delta: OspDelta }) {
  const { t } = useTranslation();
  const deltaAedN = parseFloat(delta.deltaAed);
  const isNegative = deltaAedN < 0;
  const deltaColorClass = isNegative ? 'text-terracotta' : 'text-success';
  const deltaBorderClass = isNegative
    ? 'border-terracotta/30 bg-terracotta/5'
    : 'border-success/30 bg-success/5';

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      aria-live="polite"
      aria-label={t('financial.tradeMargin.recompute.delta.title')}
      className="rounded-lg border border-border bg-card p-5"
    >
      <h3 className="mb-4 text-sm font-semibold text-ink">
        {t('financial.tradeMargin.recompute.delta.title')}
      </h3>

      <div className="flex items-center gap-4">
        {/* Before card — portfolio aggregate margin BEFORE recompute.
            BUG-003 fix (QA Phase 3 autonomous run 2026-05-30): previously showed
            "Previous OSP" with delta.before.osp (= marginPerBbl) — mislabeled the
            margin/bbl as OSP. fn_margin_recompute_for_price_change does not return
            the prior OSP; we only have the prior portfolio aggregate margin. Show
            that honestly instead of fabricating an OSP label. */}
        <div className="flex-1 rounded-lg border border-border bg-surface p-4 text-center">
          <p className="text-xs text-ink-muted mb-1">
            {t('financial.tradeMargin.recompute.delta.previousAggregate')}
          </p>
          <p className="text-lg font-semibold tabular-nums text-ink">
            {formatAedCompact(delta.before.marginAed)}
          </p>
          <p className="mt-1 text-[11px] text-ink-subtle">
            {t('financial.tradeMargin.recompute.delta.portfolioCaption')}
          </p>
        </div>

        {/* Arrow + delta */}
        <div className="flex flex-col items-center gap-1.5">
          <ArrowRight
            className="h-6 w-6 text-ink-muted shrink-0"
            aria-hidden="true"
          />
          <div className={`rounded-md border px-3 py-1.5 ${deltaBorderClass}`}>
            <p
              className={`text-sm font-bold tabular-nums ${deltaColorClass}`}
            >
              {isNegative ? '' : '+'}
              {formatAedCompact(delta.deltaAed)}
            </p>
            <p className="text-[10px] text-center text-ink-muted mt-0.5">
              {t('financial.tradeMargin.recompute.delta.deltaLabel')}
            </p>
          </div>
        </div>

        {/* After card — new OSP + portfolio aggregate after recompute */}
        <div className="flex-1 rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-xs text-ink-muted mb-1">
            {t('financial.tradeMargin.recompute.delta.newOsp')}
          </p>
          <p className="text-lg font-semibold tabular-nums text-ink">
            ${parseFloat(delta.after.osp).toFixed(2)}/bbl
          </p>
          <p className={`mt-1 text-xs tabular-nums font-semibold ${deltaColorClass}`}>
            {formatAedCompact(delta.after.marginAed)}
          </p>
        </div>
      </div>
    </motion.section>
  );
}
