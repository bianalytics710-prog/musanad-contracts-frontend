/**
 * M15 / CR-G — Finance & Treasury persona dashboard.
 *
 * GET /api/v1/dashboards/finance-treasury?windowDays=N
 * Permission: insights.finance_treasury
 *
 * Sections:
 *   1. KPI strip (4 tiles) — total exposure / FX exposure / price-review triggered / payment delays
 *   2. FX Volatility tile — AED-peg status note
 *   3. Price-Review Trigger Queue — correlations tagged Brent/Dubai/Murban
 *   4. Payment Delay Register — empty-state v1
 *   5. Currency Exposure Breakdown — Recharts PieChart
 *
 * T1–T13 compliance. Auto-refresh 60s. RTL parity. Three data states.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from '@tanstack/react-router';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { BarChart2, DollarSign, Shield } from 'lucide-react';
import { useFinanceTreasuryDashboard } from '../hooks/useCrgDashboards';
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardFreshness,
  DashboardLoadingSkeleton,
  KpiTile,
  TimeRangeSelector,
  rangeFromWindowDays,
} from './dashboard-primitives';
import { useAuthStore, selectUser } from '@/store/auth.store';
import { formatDateTime, formatDate, formatHijriDate } from '@/utils/datetime';
import type { DashboardRangeKey } from '@/types/entities/dashboards.types';
import type {
  PriceReviewRow,
  CurrencyExposureRow,
  FxVolatilityTile as FxVolatilityTileType,
} from '@/types/entities/crg-dashboards.types';
import {
  InitiatePriceReviewDialog,
  RecommendPaymentHoldDialog,
  InitiateHedgeReviewDialog,
} from '@/features/finance-treasury/components/ActionDialogs';
import { PaymentDelayRegisterTable } from '@/features/finance-treasury/components/PaymentDelayRegisterTable';
import { CommodityExposureSection } from '@/features/finance-treasury/components/CommodityExposureSection';
import { FxHistoryChart } from '@/features/finance-treasury/components/FxHistoryChart';

function formatAedCompact(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    if (num >= 1_000_000) return `AED ${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `AED ${(num / 1_000).toFixed(1)}K`;
    return `AED ${num.toFixed(0)}`;
  }
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-AE').format(n);
}

function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, string> = {
    critical: 'bg-terracotta/20 text-terracotta border-terracotta/30',
    high: 'bg-amber/20 text-amber border-amber/30',
    medium: 'bg-gold/20 text-ink border-gold/30',
    low: 'bg-sage/20 text-sage border-sage/30',
  };
  const cls = colorMap[severity.toLowerCase()] ?? 'bg-muted text-ink-muted border-border';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {severity}
    </span>
  );
}

// Semantic color palette for pie chart — using CSS vars where possible
const PIE_COLORS = [
  'var(--gold)',
  'var(--sage)',
  'var(--terracotta)',
  'var(--amber)',
  '#7B9E87',
  '#C4A882',
];

const DEFAULT_WINDOW = 30;

export function FinanceTreasuryDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [range, setRange] = useState<DashboardRangeKey>(rangeFromWindowDays(DEFAULT_WINDOW));

  const { data, isLoading, isError, error, refetch } = useFinanceTreasuryDashboard(windowDays);

  const nowISO = new Date().toISOString();

  // L2: first-name only welcome
  const welcomeName = user ? user.firstName : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6 p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-subtle">
            {welcomeName
              ? `${t('dashboards.common.welcome', { defaultValue: 'Welcome back' })}, ${welcomeName} · ${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`
              : `${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('dashboards.financeTreasury.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('dashboards.financeTreasury.subtitle')}
          </p>
          {data?.asOf && <DashboardFreshness asOf={data.asOf} className="mt-1" />}
        </div>
        <TimeRangeSelector
          range={range}
          windowDays={windowDays}
          minWindowDays={7}
          onChange={({ range: r, windowDays: d }) => {
            setRange(r);
            setWindowDays(d);
          }}
        />
      </header>

      {isLoading && !data ? (
        <DashboardLoadingSkeleton rows={2} />
      ) : isError ? (
        <DashboardErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackKey="dashboards.financeTreasury.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* KPI strip */}
          <section
            aria-label={t('dashboards.financeTreasury.kpiGroupLabel')}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t('dashboards.financeTreasury.kpis.totalExposure')}
              value={formatAedCompact(data.kpi.totalExposureAed)}
              variant="success"
            />
            <KpiTile
              label={t('dashboards.financeTreasury.kpis.fxExposure')}
              value={formatAedCompact(data.kpi.fxExposureNonAedAed)}
              variant={Number(data.kpi.fxExposureNonAedAed) > 0 ? 'warning' : 'default'}
            />
            <KpiTile
              label={t('dashboards.financeTreasury.kpis.priceReviewTriggered')}
              value={formatNumber(data.kpi.priceReviewTriggeredCount)}
              variant={data.kpi.priceReviewTriggeredCount > 0 ? 'warning' : 'default'}
            />
            <KpiTile
              label={t('dashboards.financeTreasury.kpis.paymentDelays')}
              value={formatNumber(data.kpi.paymentDelaysCount)}
              variant={data.kpi.paymentDelaysCount > 0 ? 'risk' : 'default'}
            />
          </section>

          {/* FX Volatility tile */}
          <FxVolatilityCard tile={data.fxVolatilityTile} />

          {/* Price-Review Trigger Queue */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gold" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.financeTreasury.sections.priceReview')}
              </h2>
            </div>
            <PriceReviewList rows={data.priceReviewTriggerQueue} />
          </section>

          {/* Payment Delay Register (H2 — real table) */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t('dashboards.financeTreasury.sections.paymentDelays')}
            </h2>
            <PaymentDelayRegisterTable rows={data.paymentDelayRegister} />
          </section>

          {/* Commodity Exposure (H3) */}
          {data.commodityExposure && (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-amber" aria-hidden />
                <h2 className="text-sm font-semibold text-ink">
                  {t('dashboards.financeTreasury.sections.commodityExposure')}
                </h2>
              </div>
              <CommodityExposureSection data={data.commodityExposure} />
            </section>
          )}

          {/* FX History Chart (H4) */}
          {data.fxHistory && (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-sage" aria-hidden />
                <h2 className="text-sm font-semibold text-ink">
                  {t('dashboards.financeTreasury.sections.fxHistory')}
                </h2>
              </div>
              <FxHistoryChart data={data.fxHistory} />
            </section>
          )}

          {/* Currency Exposure Breakdown */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-sage" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">
                {t('dashboards.financeTreasury.sections.currencyExposure')}
              </h2>
            </div>
            <CurrencyExposureSection rows={data.currencyExposureBreakdown} />
          </section>
        </>
      )}
    </motion.div>
  );
}

function FxVolatilityCard({ tile }: { tile: FxVolatilityTileType }) {
  const { t } = useTranslation();
  return (
    <section
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
      aria-label={t('dashboards.financeTreasury.fxTile.ariaLabel')}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/20">
        <Shield className="h-5 w-5 text-sage" aria-hidden />
      </div>
      <div className="flex-1">
        <p className="font-medium text-ink">
          {t('dashboards.financeTreasury.fxTile.peggedNote')}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t('dashboards.financeTreasury.fxTile.checkedAt', {
            time: formatDateTime(tile.lastCheckedAt),
          })}
          {tile.nonAedContractCount > 0 &&
            ` · ${tile.nonAedContractCount} ${t('dashboards.financeTreasury.fxTile.nonAedContracts')}`}
        </p>
      </div>
      <span className="rounded-full bg-sage/20 px-3 py-1 font-mono text-xs font-medium text-sage">
        {tile.aedPegStatus === 'stable'
          ? t('dashboards.financeTreasury.fxTile.stable')
          : t('dashboards.financeTreasury.fxTile.deviation')}
      </span>
    </section>
  );
}

function PriceReviewList({ rows }: { rows: PriceReviewRow[] }) {
  const { t } = useTranslation();
  const [priceReviewContractId, setPriceReviewContractId] = useState<string | null>(null);
  const [priceReviewCorrId, setPriceReviewCorrId] = useState<string | undefined>(undefined);
  const [priceReviewOpen, setPriceReviewOpen] = useState(false);
  const [holdContractId, setHoldContractId] = useState<string | null>(null);
  const [holdOpen, setHoldOpen] = useState(false);
  const [hedgeContractId, setHedgeContractId] = useState<string | null>(null);
  const [hedgeOpen, setHedgeOpen] = useState(false);

  if (rows.length === 0) {
    return (
      <DashboardEmptyState description={t('dashboards.financeTreasury.empty.noPriceReview')} />
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.financeTreasury.table.contract')}</th>
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.financeTreasury.table.counterparty')}</th>
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.financeTreasury.table.index')}</th>
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.financeTreasury.table.trigger')}</th>
              <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.financeTreasury.table.marAed')}</th>
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.financeTreasury.table.occurredAt')}</th>
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.financeTreasury.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.correlationId} className="border-t border-border/60">
                <td className="py-2 pe-3">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: row.contractId }}
                    className="font-mono text-xs text-gold hover:underline"
                  >
                    {row.contractNumber}
                  </Link>
                </td>
                <td className="py-2 pe-3 text-ink">{row.counterpartyName}</td>
                <td className="py-2 pe-3">
                  {row.indexName ? (
                    <span className="inline-flex rounded bg-gold/15 px-2 py-0.5 font-mono text-[10px] text-ink">
                      {row.indexName}
                    </span>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </td>
                <td className="py-2 pe-3 text-xs text-ink-muted max-w-xs truncate">
                  {row.triggerHeadline}
                </td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                  {formatAedCompact(row.marAed)}
                </td>
                <td className="py-2 pe-3 text-xs text-ink-subtle">
                  {formatDateTime(row.occurredAt, { showTime: false })}
                </td>
                {/* H5 per-row actions */}
                <td className="py-2 pe-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPriceReviewContractId(row.contractId);
                        setPriceReviewCorrId(row.correlationId);
                        setPriceReviewOpen(true);
                      }}
                      className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-gold/60 hover:bg-gold/10"
                      aria-label={t('finance.actions.priceReview.title')}
                    >
                      {t('finance.actions.priceReview.shortLabel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHoldContractId(row.contractId);
                        setHoldOpen(true);
                      }}
                      className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-amber/60 hover:bg-amber/10"
                      aria-label={t('finance.actions.paymentHold.title')}
                    >
                      {t('finance.actions.paymentHold.shortLabel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHedgeContractId(row.contractId);
                        setHedgeOpen(true);
                      }}
                      className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-ink hover:border-sage/60 hover:bg-sage/10"
                      aria-label={t('finance.actions.hedgeReview.title')}
                    >
                      {t('finance.actions.hedgeReview.shortLabel')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InitiatePriceReviewDialog
        contractId={priceReviewContractId}
        correlationId={priceReviewCorrId}
        open={priceReviewOpen}
        onClose={() => {
          setPriceReviewOpen(false);
          setPriceReviewContractId(null);
          setPriceReviewCorrId(undefined);
        }}
      />
      <RecommendPaymentHoldDialog
        contractId={holdContractId}
        open={holdOpen}
        onClose={() => {
          setHoldOpen(false);
          setHoldContractId(null);
        }}
      />
      <InitiateHedgeReviewDialog
        contractId={hedgeContractId}
        open={hedgeOpen}
        onClose={() => {
          setHedgeOpen(false);
          setHedgeContractId(null);
        }}
      />
    </>
  );
}

function CurrencyExposureSection({ rows }: { rows: CurrencyExposureRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <DashboardEmptyState description={t('dashboards.financeTreasury.empty.noCurrencies')} />
    );
  }
  const chartData = rows.map((r) => ({
    name: r.currency,
    value: Number(r.aggregateValueAed),
  }));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              aria-label={t('dashboards.financeTreasury.chart.currencyPieAriaLabel')}
            >
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => [formatAedCompact(v), t('dashboards.financeTreasury.chart.exposure')]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(v) => <span className="text-xs text-ink-muted">{v}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
              <th scope="col" className="py-2 pe-3 font-medium">{t('dashboards.financeTreasury.table.currency')}</th>
              <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.financeTreasury.table.contracts')}</th>
              <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.financeTreasury.table.valueAed')}</th>
              <th scope="col" className="py-2 pe-3 font-medium tabular-nums">{t('dashboards.financeTreasury.table.pctPortfolio')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.currency} className="border-t border-border/60">
                <td className="py-2 pe-3 font-mono text-sm font-medium text-ink">{row.currency}</td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">{formatNumber(row.contractCount)}</td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">{formatAedCompact(row.aggregateValueAed)}</td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                  {(row.percentOfTotal * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FinanceTreasuryDashboard;
