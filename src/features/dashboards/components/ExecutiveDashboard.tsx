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
  Pie,
  PieChart,
  Legend,
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
  formatAedAxis,
  formatAedCompact,
  formatNumber,
  formatUsd,
  humanizeLabel,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import { useAuthStore, selectUser } from "@/store/auth.store";
import { formatDate, formatHijriDate } from "@/utils/datetime";
import type {
  CounterpartyConcentrationRow,
  DashboardRangeKey,
  ExecutiveExpiryCliffs,
  TrendMonthCount,
  TrendMonthValueAed,
  ValueDistributionBucket,
} from "@/types/entities/dashboards.types";
import { ExecutiveAnomaliesCard } from "@/features/ai/components/ExecutiveAnomaliesCard";
import { ExecutiveCharts } from "./ExecutiveCharts";
import { ExecutiveLists } from "./ExecutiveLists";
import { ExecutiveEventsCard } from "./ExecutiveEventsCard";
// M14 — CR-F: AVaR extension
import { AvarDashboardSection } from "./AvarDashboardSection";
// M15 — CR-G: Executive dashboard extension (3 new sections)
import { ExecutiveCrgExtension } from "./ExecutiveCrgExtension";
// M21 — CR-N: Budget Burn rollup section
import { ExecutiveBudgetBurnSection } from "./ExecutiveBudgetBurnSection";
import type { BudgetBurnSummary } from "@/types/entities/budget-burn.types";
// M21 — CR-O: Trade Margin rollup section
import { ExecutiveTradeMarginSection } from "./ExecutiveTradeMarginSection";
import type { TradeMarginSummary } from "@/types/entities/trade-margin.types";
import type {
  AiExecutiveAnomaliesStats,
  AiLanguage,
} from "@/types/entities/ai.types";
import type {
  ExecutiveDashboardCrgAdditions,
  WhatChangedTodayRow,
  RecommendedActionRow,
  ClausesTriggeredPayload,
} from "@/types/entities/crg-dashboards.types";

const DEFAULT_WINDOW_DAYS = 90;

export function ExecutiveDashboard() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore(selectUser);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useExecutiveDashboard(
    asWindowQuery(windowDays),
  );

  const nowISO = new Date().toISOString();

  const anomaliesStats: AiExecutiveAnomaliesStats | null = useMemo(() => {
    if (!data) return null;
    const totalActiveValueAed = Number(data.kpis.totalActiveValueAed);
    const contractsByStatus = Object.fromEntries(
      Object.entries(data.kpis.contractsByStatus).map(([k, v]) => [k, Number(v)]),
    );
    return {
      totalActiveValueAed,
      contractsByStatus,
      expiryCliffs: [
        { window: "next30d", count: data.kpis.expiryCliffs.next30d },
        { window: "next60d", count: data.kpis.expiryCliffs.next60d },
        { window: "next90d", count: data.kpis.expiryCliffs.next90d },
      ],
      supplierConcentration: data.kpis.topCounterpartiesByValue5.map((c) => ({
        supplier: `counterparty-${c.counterpartyId}`,
        share: Math.min(
          1,
          Math.max(
            0,
            totalActiveValueAed > 0
              ? Number(c.totalValueAed) / totalActiveValueAed
              : 0,
          ),
        ),
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
          {/* R-EX0 — welcome line + Hijri date strip mirroring LC / approver / recipient. */}
          <p className="text-xs text-ink-subtle">
            {user
              ? `${t("dashboards.common.welcome", { defaultValue: "Welcome back" })}, ${user.firstName} ${user.lastName} · ${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`
              : `${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`}
          </p>
          {/* R-EX0 — H1 wording: "Enterprise overview" (Lovable parity, Q2=2a). */}
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("dashboards.executive.title", { defaultValue: "Enterprise overview" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.executive.subtitle")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <TimeRangeSelector
            range={range}
            windowDays={windowDays}
            onChange={({ range: r, windowDays: d }) => {
              setRange(r);
              setWindowDays(d);
            }}
          />
          {/* BUG-013 clarification (QA Phase 3.2 from user screenshot 2026-05-31):
              the AVaR snapshot KPIs (TOTAL AVAR / NO-VALUE CONTRACTS) reflect the
              latest risk-score state and don't move with the date filter. Only
              the prior-window delta is window-scoped. Surface that so the user
              isn't confused when KPI numbers don't change on filter click. */}
          <p className="text-[10px] text-ink-subtle">
            {t("dashboards.executive.windowScopeHint", {
              defaultValue: "Snapshot KPIs use latest data. Date filter scopes prior-window delta + trends.",
            })}
          </p>
        </div>
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
          {/* M14 — CR-F: AVaR section (before existing R-EX KPIs per brief).
              Defensive: AvarDashboardSection renders nothing on 403 or error. */}
          <AvarDashboardSection windowDays={windowDays} />

          {/* R-EX0 — Top-line KPIs aligned to Lovable.
              5 tiles when AI cost is hidden:
                Total contract value / Active contracts / Avg cycle time /
                Renewals (90d) / Renewal value (90d).
              6 tiles when the actor has ai.observability.read — AI cost added
              between Renewals and Renewal value. The legacy "Window (days)"
              tile is dropped — the time range tabs already convey window.
              Per-tile delta indicators are computed against kpiPrev (returned
              by migration 089). */}
          <section
            aria-label={t("dashboards.executive.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <KpiTile
              label={t("dashboards.executive.kpis.totalContractValue", {
                defaultValue: "Total contract value",
              })}
              value={formatAedCompact(data.kpis.totalActiveValueAed)}
              helper={formatPctDelta(
                data.kpis.totalActiveValueAed,
                data.kpiPrev?.totalActiveValueAed,
                t,
              )}
              variant="success"
            />
            <KpiTile
              label={t("dashboards.executive.kpis.activeContracts", {
                defaultValue: "Active contracts",
              })}
              value={formatNumber(data.kpis.activeContractsCount)}
              helper={formatCountDelta(
                data.kpis.activeContractsCount,
                data.kpiPrev?.activeContractsCount,
                t,
              )}
            />
            <KpiTile
              label={t("dashboards.executive.kpis.avgCycleTime", {
                defaultValue: "Avg. cycle time",
              })}
              value={`${data.kpis.avgCycleTimeDays.toFixed(1)}d`}
            />
            <KpiTile
              label={t("dashboards.executive.kpis.renewals90d", {
                defaultValue: "Renewals (90d)",
              })}
              value={formatNumber(data.kpis.renewalsCount90d)}
              helper={formatCountDelta(
                data.kpis.renewalsCount90d,
                data.kpiPrev?.renewalsCount90d,
                t,
              )}
            />
            <KpiTile
              label={t("dashboards.executive.kpis.renewalValue90d", {
                defaultValue: "Renewal value (90d)",
              })}
              value={formatAedCompact(data.kpis.renewalValueAed90d)}
              helper={formatPctDelta(
                data.kpis.renewalValueAed90d,
                data.kpiPrev?.renewalValueAed90d,
                t,
              )}
            />
            {/* R-EX0 — AI cost tile is shown ONLY when the actor has
                ai.observability.read (server returns aiCostUsdWindow != null
                in that case). Q3 = 3a: hide when forbidden rather than
                rendering a permission-denied warning on the tile. */}
            {data.kpis.aiCostUsdWindow !== null && (
              <KpiTile
                label={t("dashboards.executive.kpis.aiCostUsdWindow")}
                value={formatUsd(data.kpis.aiCostUsdWindow)}
                helper={t("dashboards.executive.kpis.aiCostHelper")}
              />
            )}
            {/* R-EX0 — Critical regulatory impacts is local-only intel
                (M5). Keep alongside the Lovable five so executives still
                see the regulator-aware gate. */}
            <KpiTile
              label={t("dashboards.executive.kpis.openRegulatoryImpactsCritical")}
              value={formatNumber(data.kpis.openRegulatoryImpactsCritical)}
              variant={
                data.kpis.openRegulatoryImpactsCritical > 0 ? "risk" : "default"
              }
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
            <TopCounterpartiesBlockWithNames
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

          {/* R-EX1 — six Lovable-parity chart sections (spendByCategory /
              topSuppliers / revenueUnderContract12m / cycleTimeFunnel /
              contractThroughput12m / expiryCliff). Backed by migration 090. */}
          {data.charts && (
            <ExecutiveCharts
              charts={data.charts}
              cycleTimeFunnel={data.kpis.cycleTimeFunnel}
              totalValueAed={data.kpis.totalActiveValueAed}
            />
          )}

          {/* R-EX2 — three Lovable-parity list sections
              (highRiskContracts8 / mostUsedTemplates8 /
              mostAmendedContracts5). Backed by migration 091. */}
          {data.lists && <ExecutiveLists lists={data.lists} />}

          {/* R-EX3 — Executive events (last 14 days) timeline.
              Backed by migration 092/093. Single chronological feed
              of regulatory_update + contract_activity events. */}
          {data.events14d && <ExecutiveEventsCard rows={data.events14d} />}

          {anomaliesStats && (
            <ExecutiveAnomaliesCard
              stats={anomaliesStats}
              language={language}
              autoFetch
            />
          )}

          {/* M15 — CR-G: 3 additive executive sections (whatChangedToday / recommendedActions / clausesTriggered).
              Defensive guards: sections only render when arrays are non-empty.
              The existing R-EX payload returns these keys as of migration 180. */}
          <ExecutiveCrgExtension
            whatChangedToday={(data as unknown as ExecutiveDashboardCrgAdditions).whatChangedToday ?? []}
            recommendedActions={(data as unknown as ExecutiveDashboardCrgAdditions).recommendedActions ?? []}
            clausesTriggered={(data as unknown as ExecutiveDashboardCrgAdditions).clausesTriggered ?? { last7d: [], last30d: [] }}
          />

          {/* M21 — CR-N: Budget Burn rollup (10th additive key on fn_dashboard_executive).
              Defensive: renders nothing when budgetBurnSummary is absent (pre-mig or no budgets). */}
          <ExecutiveBudgetBurnSection
            budgetBurnSummary={
              (data as unknown as { budgetBurnSummary?: BudgetBurnSummary }).budgetBurnSummary ?? null
            }
          />

          {/* M21 — CR-O: Trade Margin rollup (11th additive key on fn_dashboard_executive).
              Defensive: renders nothing when tradeMarginSummary is absent (pre-mig or no positions). */}
          <ExecutiveTradeMarginSection
            tradeMarginSummary={
              (data as unknown as { tradeMarginSummary?: TradeMarginSummary }).tradeMarginSummary ?? null
            }
          />
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
  // E10 fix: sort descending so the dominant bucket sits at top and
  // small buckets aren't dwarfed-toothpicks at the bottom.
  // E11/E15 fix: humanize status slugs ("awaiting_counterparty" → "Awaiting counterparty").
  const series = Object.entries(data)
    .map(([status, count]) => ({
      status,
      label: t(`contractStatus.${status}`, { defaultValue: humanizeLabel(status) }),
      count,
    }))
    .sort((a, b) => b.count - a.count);
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
                  defaultValue: humanizeLabel(b.bucket),
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

function TopCounterpartiesBlockWithNames({
  rows,
  totalValue,
}: {
  rows: CounterpartyConcentrationRow[];
  totalValue: number;
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

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
            // Names are now embedded in the row by the BE (CR-FIX1).
            const name =
              isAr && row.counterpartyNameAr
                ? row.counterpartyNameAr
                : row.counterpartyName;
            return (
              <tr
                key={row.counterpartyId}
                className="border-t border-border/60"
              >
                <td className="py-2 pe-3">
                  {name ? (
                    <>
                      <span className="text-sm font-medium text-ink">
                        {name}
                      </span>
                      {row.counterpartyEmirate && (
                        // E15 fix: title-case emirate ("fujairah" → "Fujairah",
                        // "abu_dhabi" → "Abu Dhabi"). Drop uppercase tracking
                        // for the same reason.
                        <span className="ms-2 inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-subtle">
                          {humanizeLabel(row.counterpartyEmirate)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-mono text-xs text-ink-subtle">
                      {t("dashboards.executive.topCounterparties.idLabel", {
                        id: row.counterpartyId,
                      })}
                    </span>
                  )}
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
            // E7 fix: shared AED axis formatter — handles B/M/K so 30B
            // doesn't render as "30000.0M".
            tickFormatter={formatAedAxis}
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

// ─── R-EX0 KPI delta helpers ─────────────────────────────────────────────────

/**
 * Render a "+X.X% vs prev" / "-X.X% vs prev" string for a tile helper line.
 * Returns undefined when no comparison value is available so KpiTile renders
 * cleanly without a helper row.
 */
function formatPctDelta(
  current: number,
  previous: number | undefined,
  t: (key: string, opts?: { defaultValue?: string; pct?: string }) => string,
): string | undefined {
  if (previous === undefined || previous === null) return undefined;
  if (previous === 0) return undefined;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  const display = `${sign}${pct.toFixed(1)}%`;
  return t("dashboards.executive.kpis.deltaVsPrev", {
    defaultValue: `${display} vs prev`,
    pct: display,
  });
}

/**
 * Render a "+N vs prev" / "-N vs prev" string for count-based KPIs.
 */
function formatCountDelta(
  current: number,
  previous: number | undefined,
  t: (key: string, opts?: { defaultValue?: string; n?: string }) => string,
): string | undefined {
  if (previous === undefined || previous === null) return undefined;
  const diff = current - previous;
  if (diff === 0) return undefined;
  const sign = diff > 0 ? "+" : "";
  const display = `${sign}${diff}`;
  return t("dashboards.executive.kpis.deltaCountVsPrev", {
    defaultValue: `${display} vs prev`,
    n: display,
  });
}

export default ExecutiveDashboard;
