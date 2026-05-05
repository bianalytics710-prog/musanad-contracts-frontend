/**
 * ExecutiveDashboard (S7) — M_parity polish.
 *
 * Mode: REGENERATE → POLISHED. Visual structure adapted from Lovable's
 * 1825L ExecutiveDashboard.tsx. Trend tables replaced with recharts
 * line/bar charts; expiry cliffs and counterparty-share rendered as
 * progress bars; value distribution as horizontal bars. All data shapes
 * remain our fn_dashboard_executive contract.
 *
 *   GET /api/v1/dashboards/executive?windowDays=N
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, AlertTriangle, Building2, BarChart3 } from "lucide-react";
import { useExecutiveDashboard } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  KpiTile,
  TimeRangeSelector,
  asWindowQuery,
  formatAed,
  formatNumber,
  formatUsd,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import type {
  CounterpartyConcentrationRow,
  DashboardRangeKey,
  ExecutiveExpiryCliffs,
  TrendMonthCount,
  TrendMonthValueAed,
  ValueDistributionBucket,
} from "@/types/entities/dashboards.types";
import { ExecutiveAnomaliesCard } from "@/features/ai/components/ExecutiveAnomaliesCard";
import type {
  AiExecutiveAnomaliesStats,
  AiLanguage,
} from "@/types/entities/ai.types";

const DEFAULT_WINDOW_DAYS = 90;

export function ExecutiveDashboard() {
  const { t, i18n } = useTranslation();
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useExecutiveDashboard(
    asWindowQuery(windowDays),
  );

  const anomaliesStats: AiExecutiveAnomaliesStats | null = useMemo(() => {
    if (!data) return null;
    return {
      totalActiveValueAed: data.kpis.totalActiveValueAed,
      contractsByStatus: data.kpis.contractsByStatus,
      expiryCliffs: [
        { window: "next30d", count: data.kpis.expiryCliffs.next30d },
        { window: "next60d", count: data.kpis.expiryCliffs.next60d },
        { window: "next90d", count: data.kpis.expiryCliffs.next90d },
      ],
      supplierConcentration: data.kpis.topCounterpartiesByValue5.map((c) => ({
        supplier: `counterparty-${c.counterpartyId}`,
        share:
          data.kpis.totalActiveValueAed > 0
            ? c.totalValueAed / data.kpis.totalActiveValueAed
            : 0,
      })),
    };
  }, [data]);

  const language: AiLanguage = i18n.language?.startsWith("ar") ? "ar" : "en";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6 p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("dashboards.executive.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.executive.subtitle")}
          </p>
        </div>
        <TimeRangeSelector
          range={range}
          windowDays={windowDays}
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
          fallbackKey="dashboards.executive.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* Top-line KPIs */}
          <section
            aria-label={t("dashboards.executive.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t("dashboards.executive.kpis.totalActiveValueAed")}
              value={formatAed(data.kpis.totalActiveValueAed)}
              variant="success"
            />
            <KpiTile
              label={t("dashboards.executive.kpis.openRegulatoryImpactsCritical")}
              value={formatNumber(data.kpis.openRegulatoryImpactsCritical)}
              variant={
                data.kpis.openRegulatoryImpactsCritical > 0 ? "risk" : "default"
              }
            />
            <KpiTile
              label={t("dashboards.executive.kpis.aiCostUsdWindow")}
              value={
                data.kpis.aiCostUsdWindow == null
                  ? "—"
                  : formatUsd(data.kpis.aiCostUsdWindow)
              }
              helper={
                data.kpis.aiCostUsdWindow == null
                  ? t("dashboards.executive.kpis.aiCostDenied")
                  : t("dashboards.executive.kpis.aiCostHelper")
              }
              disabled={data.kpis.aiCostUsdWindow == null}
            />
            <KpiTile
              label={t("dashboards.executive.kpis.windowDays")}
              value={String(windowDays)}
              helper={t("dashboards.executive.kpis.windowDaysHelper")}
            />
          </section>

          {/* Expiry cliffs hero — colored progressive risk bands */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber" />
              <h3 className="text-sm font-semibold text-ink">
                {t("dashboards.executive.expiryCliffs.title")}
              </h3>
            </div>
            <p className="mb-3 text-xs text-ink-subtle">
              {t("dashboards.executive.expiryCliffs.description")}
            </p>
            <ExpiryCliffsBlock cliffs={data.kpis.expiryCliffs} />
          </section>

          {/* Status + value distribution */}
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.executive.contractsByStatus.title")}
                </h3>
              </div>
              {Object.keys(data.kpis.contractsByStatus).length === 0 ? (
                <DashboardEmptyState />
              ) : (
                <ContractsByStatusChart data={data.kpis.contractsByStatus} />
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.executive.valueDistribution.title")}
                </h3>
              </div>
              <p className="mb-3 text-xs text-ink-subtle">
                {t("dashboards.executive.valueDistribution.description")}
              </p>
              <ValueDistributionBlock buckets={data.kpis.valueDistribution} />
            </section>
          </div>

          {/* Top counterparties */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-ink">
                {t("dashboards.executive.topCounterparties.title")}
              </h3>
            </div>
            <p className="mb-3 text-xs text-ink-subtle">
              {t("dashboards.executive.topCounterparties.description")}
            </p>
            <TopCounterpartiesBlock
              rows={data.kpis.topCounterpartiesByValue5}
              totalValue={data.kpis.totalActiveValueAed}
            />
          </section>

          {/* Trends — recharts */}
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.executive.trends.valueOverTimeTitle")}
                </h3>
              </div>
              <ValueOverTimeChart points={data.trends.valueOverTimeByMonth} />
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.executive.trends.contractsCreatedTitle")}
                </h3>
              </div>
              <ContractsByMonthChart points={data.trends.contractsCreatedByMonth} />
            </section>
          </div>

          {anomaliesStats && (
            <ExecutiveAnomaliesCard
              stats={anomaliesStats}
              language={language}
              autoFetch
            />
          )}
        </>
      )}
    </motion.div>
  );
}

function ExpiryCliffsBlock({ cliffs }: { cliffs: ExecutiveExpiryCliffs }) {
  const { t } = useTranslation();
  const max = Math.max(cliffs.next30d, cliffs.next60d, cliffs.next90d, 1);
  const items = [
    {
      key: "next30d",
      label: t("dashboards.executive.expiryCliffs.next30d"),
      count: cliffs.next30d,
      bg: "bg-terracotta",
      tint: "bg-terracotta/15",
    },
    {
      key: "next60d",
      label: t("dashboards.executive.expiryCliffs.next60d"),
      count: cliffs.next60d,
      bg: "bg-amber",
      tint: "bg-amber/15",
    },
    {
      key: "next90d",
      label: t("dashboards.executive.expiryCliffs.next90d"),
      count: cliffs.next90d,
      bg: "bg-sage",
      tint: "bg-sage/15",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((it) => {
        const pct = (it.count / max) * 100;
        return (
          <div
            key={it.key}
            className={`rounded-md border border-border ${it.tint} p-3`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                {it.label}
              </p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-ink">
                {formatNumber(it.count)}
              </p>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted">
              <div
                className={`h-1.5 rounded-full ${it.bg} transition-all`}
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContractsByStatusChart({ data }: { data: Record<string, number> }) {
  const { t } = useTranslation();
  const series = Object.entries(data).map(([status, count]) => ({
    status,
    label: t(`contractStatus.${status}`, { defaultValue: status }),
    count,
  }));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={series}
          margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--ink-muted)" }} />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
            }}
          />
          <Bar dataKey="count" fill="var(--gold)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ValueDistributionBlock({
  buckets,
}: {
  buckets: ValueDistributionBucket[];
}) {
  const { t } = useTranslation();
  if (buckets.length === 0) return <DashboardEmptyState />;
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <ul className="space-y-2">
      {buckets.map((b) => {
        const pct = (b.count / maxCount) * 100;
        return (
          <li key={b.bucket} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs text-ink-subtle">
                {t(`dashboards.executive.valueDistribution.bucket.${b.bucket}`, {
                  defaultValue: b.bucket,
                })}
              </span>
              <span className="text-sm font-semibold tabular-nums text-ink">
                {formatNumber(b.count)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-gold transition-all"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TopCounterpartiesBlock({
  rows,
  totalValue,
}: {
  rows: CounterpartyConcentrationRow[];
  totalValue: number;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th className="py-2 pe-3 font-medium">
              {t("dashboards.executive.topCounterparties.counterparty")}
            </th>
            <th className="py-2 pe-3 font-medium tabular-nums">
              {t("dashboards.executive.topCounterparties.totalValue")}
            </th>
            <th className="py-2 pe-3 font-medium tabular-nums">
              {t("dashboards.executive.topCounterparties.contractCount")}
            </th>
            <th className="py-2 pe-3 font-medium tabular-nums">
              {t("dashboards.executive.topCounterparties.share", {
                defaultValue: "Share",
              })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const share =
              totalValue > 0
                ? Math.round((row.totalValueAed / totalValue) * 100)
                : 0;
            return (
              <tr
                key={row.counterpartyId}
                className="border-t border-border/60"
              >
                <td className="py-2 pe-3">
                  <span className="font-mono text-xs text-ink-subtle">
                    {t("dashboards.executive.topCounterparties.idLabel", {
                      id: row.counterpartyId,
                    })}
                  </span>
                  <span className="ms-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                    {t("dashboards.executive.topCounterparties.namePending")}
                  </span>
                </td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                  {formatAed(row.totalValueAed)}
                </td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                  {formatNumber(row.contractCount)}
                </td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-1.5 w-12 rounded-full bg-muted">
                      <span
                        className="block h-1.5 rounded-full bg-gold"
                        style={{ width: `${share}%` }}
                      />
                    </span>
                    {share}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ValueOverTimeChart({ points }: { points: TrendMonthValueAed[] }) {
  if (points.length === 0) return <DashboardEmptyState />;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
        >
          <defs>
            <linearGradient id="execValueArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B8935A" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#B8935A" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--ink-muted)" }} />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                  ? `${Math.round(v / 1_000)}k`
                  : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(v: number) => formatAed(v)}
          />
          <Area
            type="monotone"
            dataKey="totalValueAed"
            stroke="#B8935A"
            strokeWidth={2}
            fill="url(#execValueArea)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ContractsByMonthChart({ points }: { points: TrendMonthCount[] }) {
  if (points.length === 0) return <DashboardEmptyState />;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--ink-muted)" }} />
          <YAxis tick={{ fontSize: 10, fill: "var(--ink-muted)" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#5B8374"
            strokeWidth={2.5}
            dot={{ fill: "#5B8374", r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ExecutiveDashboard;
