/**
 * /app/financial/trade-margin/:positionId — Trade Position detail.
 *
 * CR-O — M21 Financial Intelligence (Trade Margin). Primary persona: finance_treasury.
 *
 * Sections:
 *   1. Position header (ref, side, grade, counterparty, volume, status)
 *   2. Latest margin KPI strip (margin/bbl, total AED, total USD, recommendation)
 *   3. Margin breakdown waterfall table (revenue vs cost components — AC#4)
 *   4. Current benchmark (Murban OSP) context — for seller side
 *   5. Margin snapshot history trend table (AC#6)
 *   6. Buy-and-refine economics + recommendation badge — buyer side only (AC#3)
 *   7. "Price update & recompute" panel (gated finance.trade.manage — AC#2)
 *
 * Standards:
 *   A7:  all HTTP via financialTradeMarginService
 *   C13: no raw hex — semantic tokens only
 *   C14: Router Link / ArrowLeft for internal nav
 *   D6:  htmlFor+id on form fields
 *   D7:  scope="col" on all <th>
 *   T3:  all strings via t()
 *   T4:  loading / empty / error states
 *   T11: ErrorBoundary at route level
 *   T12: formatDateTime for timestamps
 *   WCAG AA: labels, aria-live, role="alert"
 */
import { useState, useId } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { financialTradeMarginService } from '@/services/api/financial-trade-margin.service';
import { translateApiError } from '@/lib/translate-api-error';
import { formatDateTime } from '@/utils/datetime';
import type {
  TradePosition,
  MarginSnapshotHistoryItem,
  MarginRecomputeResult,
  CostComponentItem,
  MarginRecommendation,
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
// Main view
// ─────────────────────────────────────────────────────────────
function TradeMarginDetailView() {
  const { t } = useTranslation();
  const { positionId } = Route.useParams();
  const posId = parseInt(positionId, 10);

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

      {/* ── Section 1: Position header ── */}
      <PositionHeader position={position} />

      {/* ── Section 2: Latest margin KPIs ── */}
      {position.latestMargin ? (
        <LatestMarginKpis position={position} />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">
            {t('financial.tradeMargin.detail.noMarginYet')}
          </p>
        </div>
      )}

      {/* ── Section 3: Margin breakdown waterfall (AC#4) ── */}
      <MarginBreakdownSection position={position} />

      {/* ── Section 4: Current benchmark context (seller only) ── */}
      {position.side === 'sell' && (
        <BenchmarkContext position={position} />
      )}

      {/* ── Section 6: Buy-and-refine economics (buyer only — AC#3) ── */}
      {position.side === 'buy' && (
        <BuyAndRefineSection position={position} />
      )}

      {/* ── Section 5: Margin snapshot history trend (AC#6) ── */}
      <SnapshotHistorySection
        snapshots={snapshots}
        isLoading={historyLoading}
        isError={historyError}
        side={position.side}
      />

      {/* ── Section 7: Price update & recompute panel (AC#2 — manage only) ── */}
      {canManage && (
        <RecomputePanel
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
        />
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
// PositionHeader
// ─────────────────────────────────────────────────────────────
function PositionHeader({ position }: { position: TradePosition }) {
  const { t } = useTranslation();
  const isSell = position.side === 'sell';
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {position.positionRef}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
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
          <p className="font-medium text-ink">
            {position.counterparty.nameEn}
          </p>
          {position.counterparty.nameAr && (
            <p className="text-xs text-ink-muted" dir="rtl">
              {position.counterparty.nameAr}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4 text-sm">
        <div>
          <span className="text-ink-muted">
            {t('financial.tradeMargin.detail.volume')}
          </span>{' '}
          <span className="font-medium text-ink">
            {parseFloat(position.volumeBbl).toLocaleString('en-US', {
              maximumFractionDigits: 0,
            })}{' '}
            bbl
          </span>
        </div>
        <div>
          <span className="text-ink-muted">
            {t('financial.tradeMargin.detail.pricingBasis')}
          </span>{' '}
          <span className="font-medium text-ink">
            {t(
              `financial.tradeMargin.pricingBasis.${position.pricingBasis}`,
              { defaultValue: position.pricingBasis },
            )}
          </span>
        </div>
        {position.linkedContract && (
          <div>
            <span className="text-ink-muted">
              {t('financial.tradeMargin.detail.linkedContract')}
            </span>{' '}
            <span className="font-medium text-ink">
              {position.linkedContract.contractNumber}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

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
// LatestMarginKpis — Section 2
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
        <p
          className={`mt-1 text-2xl font-bold tabular-nums ${marginClass}`}
        >
          {formatUsdPerBbl(m.marginPerBbl)}
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
// MarginBreakdownSection — Section 3 (revenue vs cost waterfall — AC#4)
// ─────────────────────────────────────────────────────────────
function MarginBreakdownSection({ position }: { position: TradePosition }) {
  const { t } = useTranslation();
  const components = position.costComponents;

  if (components.length === 0) {
    return (
      <section
        aria-label={t('financial.tradeMargin.detail.breakdown.sectionLabel')}
        className="rounded-lg border border-border bg-card p-5"
      >
        <h2 className="mb-3 text-sm font-semibold text-ink">
          {t('financial.tradeMargin.detail.breakdown.title')}
        </h2>
        <p className="text-sm text-ink-muted">
          {t('financial.tradeMargin.detail.breakdown.empty')}
        </p>
      </section>
    );
  }

  const revenues = components.filter((c) => c.isRevenue);
  const costs = components.filter((c) => !c.isRevenue);

  const totalCostN = costs.reduce(
    (sum, c) => sum + parseFloat(c.amountUsdPerBbl),
    0,
  );

  return (
    <section
      aria-label={t('financial.tradeMargin.detail.breakdown.sectionLabel')}
      className="rounded-lg border border-border bg-card p-5"
    >
      <h2 className="mb-4 text-sm font-semibold text-ink">
        {t('financial.tradeMargin.detail.breakdown.title')}
      </h2>
      <div className="overflow-x-auto">
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
                {t(
                  'financial.tradeMargin.detail.breakdown.columns.usdPerBbl',
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {/* Revenue rows */}
            {revenues.map((c) => (
              <ComponentRow key={c.id} component={c} isRevenue={true} />
            ))}
            {/* Cost rows */}
            {costs.map((c) => (
              <ComponentRow key={c.id} component={c} isRevenue={false} />
            ))}
            {/* Total cost row */}
            {costs.length > 0 && (
              <tr className="bg-surface">
                <td
                  colSpan={2}
                  className="px-4 py-2.5 text-xs font-semibold uppercase text-ink-muted"
                >
                  {t(
                    'financial.tradeMargin.detail.breakdown.totalCost',
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sm font-semibold text-terracotta">
                  -${totalCostN.toFixed(2)}/bbl
                </td>
              </tr>
            )}
            {/* Net margin row from latestMargin */}
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
                  {formatUsdPerBbl(position.latestMargin.marginPerBbl)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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
        {t(
          `financial.tradeMargin.componentType.${component.componentType}`,
          { defaultValue: component.componentType },
        )}
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
// BenchmarkContext — Section 4 (seller — current OSP context)
// ─────────────────────────────────────────────────────────────
function BenchmarkContext({ position }: { position: TradePosition }) {
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
      {/* Show last computed margin details */}
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
            {formatUsdPerBbl(lm.marginPerBbl)}
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
// BuyAndRefineSection — Section 6 (buyer only — AC#3)
// ─────────────────────────────────────────────────────────────
function BuyAndRefineSection({ position }: { position: TradePosition }) {
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

  return (
    <section
      aria-label={t(
        'financial.tradeMargin.detail.buyAndRefine.sectionLabel',
      )}
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
            {t(
              'financial.tradeMargin.detail.buyAndRefine.downstreamRevenue',
            )}
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
            {t(
              'financial.tradeMargin.detail.buyAndRefine.projectedMargin',
            )}
          </p>
          <p
            className={`mt-0.5 text-base font-semibold tabular-nums ${
              lm && parseFloat(lm.marginPerBbl) >= 0
                ? 'text-success'
                : 'text-terracotta'
            }`}
          >
            {lm ? formatUsdPerBbl(lm.marginPerBbl) : '—'}
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
  );
}

// ─────────────────────────────────────────────────────────────
// SnapshotHistorySection — Section 5 (AC#6)
// ─────────────────────────────────────────────────────────────
function SnapshotHistorySection({
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

  return (
    <section
      aria-label={t('financial.tradeMargin.detail.history.sectionLabel')}
      className="rounded-lg border border-border bg-card p-5"
    >
      <h2 className="mb-4 text-sm font-semibold text-ink">
        {t('financial.tradeMargin.detail.history.title')}
      </h2>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-surface"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-error" role="alert">
          {t('financial.tradeMargin.detail.history.fetchError')}
        </p>
      )}

      {!isLoading && !isError && snapshots.length === 0 && (
        <p className="text-sm text-ink-muted">
          {t('financial.tradeMargin.detail.history.empty')}
        </p>
      )}

      {!isLoading && !isError && snapshots.length > 0 && (
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
                    {t(
                      'financial.tradeMargin.detail.history.columns.ospUsed',
                    )}
                  </th>
                )}
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                >
                  {t(
                    'financial.tradeMargin.detail.history.columns.marginPerBbl',
                  )}
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums"
                >
                  {t(
                    'financial.tradeMargin.detail.history.columns.totalAed',
                  )}
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                >
                  {t(
                    'financial.tradeMargin.detail.history.columns.trigger',
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Render in reverse so newest appears at top */}
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
                      {formatUsdPerBbl(snap.marginPerBbl)}
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
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// RecomputePanel — Section 7 (AC#2 — finance.trade.manage only)
// ─────────────────────────────────────────────────────────────
function RecomputePanel({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const inputId = useId();

  const [newOsp, setNewOsp] = useState('');
  const [lastResult, setLastResult] =
    useState<MarginRecomputeResult | null>(null);

  const recomputeMutation = useMutation({
    mutationFn: () =>
      financialTradeMarginService.recomputeByPrice({
        benchmarkCode: 'murban_osp',
        newPrice: newOsp,
      }),
    onSuccess: (result) => {
      setLastResult(result);
      onSuccess();
      const deltaAed = parseFloat(result.deltaAed);
      const deltaSign = deltaAed >= 0 ? '+' : '';
      toast.success(
        t('financial.tradeMargin.recompute.successToast', {
          count: result.positionsRecomputed,
          delta: `${deltaSign}${formatAedCompact(result.deltaAed)}`,
        }),
      );
    },
    onError: (err: Error) => {
      toast.error(
        err.message ||
          t('financial.tradeMargin.recompute.errorToast'),
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
              placeholder={t(
                'financial.tradeMargin.recompute.ospPlaceholder',
              )}
              className="h-9 rounded-md border border-border bg-card ps-7 pe-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary w-36"
              aria-describedby={`${inputId}-hint`}
            />
          </div>
          <p
            id={`${inputId}-hint`}
            className="text-[11px] text-ink-subtle"
          >
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

      {/* Last recompute result */}
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
                {t(
                  'financial.tradeMargin.recompute.result.positionsRecomputed',
                )}
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
  );
}
