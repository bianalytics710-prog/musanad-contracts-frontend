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

import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ExpiryCliffFrame } from "./ExpiryCliffFrame";
import {
  criticalImpactService,
  type CriticalImpactRow,
} from "@/services/api/critical-impact.service";
import { topCounterpartyService } from "@/services/api/top-counterparty.service";
import { executiveTrendsService } from "@/services/api/executive-trends.service";
import { executiveHighRiskService } from "@/services/api/executive-high-risk.service";
import { formatDateTime } from "@/utils/datetime";
import { ChevronDown, ChevronRight, ExternalLink, Layers, Brain } from "lucide-react";
import { RiskTypePill } from "@/components/risk/RiskTypePill";
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
  humanizeLabelLocalized,
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
import {
  HighRiskContractsCard,
  MostAmendedContractsCard,
  MostUsedTemplatesCard,
} from "./ExecutiveLists";
// E-rev-12: ExecutiveEventsCard removed.
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
  // Lifted state: the Critical Impact tile toggles an inline frame that
  // renders BELOW the KPI strip (not a modal), so the open/close state
  // has to live one level above both pieces.
  const [criticalImpactOpen, setCriticalImpactOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useExecutiveDashboard(
    asWindowQuery(windowDays),
  );

  // Side-car: trend chart override — last 2 quarters (6 months) regardless of
  // the KPI windowDays. fn_dashboard_executive's trends block follows
  // p_window_days; this fn returns the same arrays for a fixed 6-month span.
  const { data: trendsExtended } = useQuery({
    queryKey: ["executive-trends-extended", 6],
    queryFn: () => executiveTrendsService.extended(6),
    staleTime: 60_000,
    enabled: !!data,
  });

  // Side-car: high-risk extended (mig 560) — adds counterpartyName + riskType
  // to each row so the ECIP "High-risk contracts" table can render the same
  // columns surfaced by the Risk Cases module. Falls back to the legacy
  // inline slice (data.lists.highRiskContracts8) when the side-car query
  // hasn't returned yet.
  const { data: highRiskExtended } = useQuery({
    queryKey: ["executive-high-risk-extended", 8],
    queryFn: () => executiveHighRiskService.list(8),
    staleTime: 60_000,
    enabled: !!data,
  });

  const nowISO = new Date().toISOString();

  const anomaliesStats: AiExecutiveAnomaliesStats | null = useMemo(() => {
    if (!data) return null;
    const totalActiveValueAed = Number(data.kpis.totalActiveValueAed);
    const contractsByStatus = Object.fromEntries(
      Object.entries(data.kpis.contractsByStatus).map(([k, v]) => [k, Number(v)]),
    );
    // E-rev-2 grounding: prefer REAL supplier names from charts.topSuppliers
    // (counterparty.name_en) so the LLM emits "Bahri", "Vitol S.A." etc.
    // instead of placeholder "Supplier A". Fall back to the legacy
    // top-counterparties projection only if topSuppliers is empty.
    const supplierConcentration =
      data.charts?.topSuppliers && data.charts.topSuppliers.length > 0
        ? data.charts.topSuppliers.slice(0, 5).map((s) => ({
            supplier: s.name,
            share: totalActiveValueAed > 0 ? Number(s.totalValueAed) / totalActiveValueAed : 0,
            contractCount: s.contractCount,
            totalValueAed: Number(s.totalValueAed),
          }))
        : data.kpis.topCounterpartiesByValue5.map((c) => ({
            supplier: `counterparty-${c.counterpartyId}`,
            share: totalActiveValueAed > 0 ? Number(c.totalValueAed) / totalActiveValueAed : 0,
          }));
    // Ground value-outlier + amendment-pattern signals with REAL contract numbers.
    const topHighRiskContracts = (data.lists?.highRiskContracts8 ?? []).slice(0, 5).map((c) => ({
      contractNumber: c.contractNumber,
      title: c.titleEn ?? c.titleAr ?? c.contractNumber,
      riskScore: c.riskScore ?? null,
      valueAed: Number(c.valueAed ?? 0),
    }));
    const mostAmendedContracts = (data.lists?.mostAmendedContracts5 ?? []).slice(0, 5).map((c) => ({
      contractNumber: c.contractNumber,
      title: c.titleEn ?? c.titleAr ?? c.contractNumber,
      amendmentCount: c.amendmentCount,
    }));
    return {
      totalActiveValueAed,
      contractsByStatus,
      expiryCliffs: [
        { window: "next30d", count: data.kpis.expiryCliffs.next30d },
        { window: "next60d", count: data.kpis.expiryCliffs.next60d },
        { window: "next90d", count: data.kpis.expiryCliffs.next90d },
      ],
      supplierConcentration,
      topHighRiskContracts,
      mostAmendedContracts,
      todayIso: new Date().toISOString().slice(0, 10),
    } as AiExecutiveAnomaliesStats;
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
        {/* E-rev-C-4: date range filter removed per executive review feedback. */}
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
          {/* E-rev-1: AVaR moved to BOTTOM (was top) per executive-review feedback —
              generic KPI tiles + charts first, AVaR breakdown last. */}

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
              variant="success"
            />
            <KpiTile
              label={t("dashboards.executive.kpis.activeContracts", {
                defaultValue: "Active contracts",
              })}
              value={formatNumber(data.kpis.activeContractsCount)}
            />
            <KpiTile
              label={t("dashboards.executive.kpis.avgCycleTime", {
                defaultValue: "Avg. cycle time",
              })}
              value={`${data.kpis.avgCycleTimeDays.toFixed(1)}d`}
              helper={t("dashboards.executive.kpis.avgCycleTimeHelper", {
                defaultValue: "Drafting → counterparty signature, end-to-end",
              })}
            />
            {/* 2026-06-04: "Renewals (90d)" count tile dropped per executive
                feedback — the value tile carries the actionable signal; the
                count duplicated information. Strip is now 5 tiles by default
                (4 visible + Renewal value), 6 when AI cost observability is
                granted. */}
            <KpiTile
              label={t("dashboards.executive.kpis.renewalValue90d", {
                defaultValue: "Renewal value (90d)",
              })}
              value={formatAedCompact(data.kpis.renewalValueAed90d)}
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
            {/* 2026-06-04 — broadened from "Critical regulatory impacts"
                to "Critical impact". The tile counts critical osint_signal
                rows + open critical risk_case rows (BE fn merges both),
                falling back to the existing exec dashboard count while
                the merged query is in flight. Clicking opens the inline
                frame below (replaces the old modal). */}
            <CriticalImpactTile
              fallbackCount={data.kpis.openRegulatoryImpactsCritical}
              open={criticalImpactOpen}
              onToggle={() => setCriticalImpactOpen((prev) => !prev)}
            />
            {/* Phase B (mig 643, 2026-06-13) — Risk Triage tile.
                Counts borderline risk-case alerts (Tier-2) waiting for the
                executive's judgement. Click navigates to /app/exec/risk-triage. */}
            <RiskTriageTile />
          </section>

          {/* Inline Critical Impact frame — collapses below the KPI strip
              when the tile is clicked. Renders rows with criticality,
              date, contracts-affected count + source URL, each expandable
              into a contract drill-down table. */}
          <CriticalImpactFrame open={criticalImpactOpen} />

          {/* ────────────────────────────────────────────────────────────
              SECTION 1 — Contract Lifecycle (CLM)
              Portfolio operations: expiry, status mix, partners, trends,
              templates and amendments. Aligns with the platform-admin
              CLM module toggle.
              ──────────────────────────────────────────────────────────── */}
          <section
            aria-label={t("dashboards.executive.sections.clm.ariaLabel", {
              defaultValue: "Contract lifecycle insights",
            })}
            className="space-y-3"
          >
            <header className="flex items-center gap-3 border-b border-border pb-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gold/10 text-gold">
                <Layers className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-ink">
                  {t("dashboards.executive.sections.clm.title", {
                    defaultValue: "Contract Lifecycle",
                  })}
                </h2>
                <p className="text-xs text-ink-subtle">
                  {t("dashboards.executive.sections.clm.subtitle", {
                    defaultValue:
                      "Portfolio health, throughput, partners and templates.",
                  })}
                </p>
              </div>
            </header>

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
                <ValueOverTimeChart
                  points={
                    trendsExtended?.valueOverTimeByMonth ??
                    data.trends.valueOverTimeByMonth
                  }
                />
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gold" />
                  <h3 className="text-sm font-semibold text-ink">
                    {t("dashboards.executive.trends.contractsCreatedTitle")}
                  </h3>
                </div>
                <ContractsByMonthChart
                  points={
                    trendsExtended?.contractsCreatedByMonth ??
                    data.trends.contractsCreatedByMonth
                  }
                />
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

            {/* Templates + amendments — split out of the legacy 3-col so
                High-risk contracts can be promoted into the ECIP section. */}
            {data.lists && (
              <div className="grid gap-4 lg:grid-cols-2">
                <MostUsedTemplatesCard rows={data.lists.mostUsedTemplates8} />
                <MostAmendedContractsCard rows={data.lists.mostAmendedContracts5} />
              </div>
            )}
          </section>

          {/* ────────────────────────────────────────────────────────────
              SECTION 2 — Contract Intelligence (ECIP)
              Risk signals, AI insights, financial intelligence. Aligns
              with the platform-admin ECIP module toggle — hiding this
              section is a one-conditional change when the module is off.
              ──────────────────────────────────────────────────────────── */}
          <section
            aria-label={t("dashboards.executive.sections.ecip.ariaLabel", {
              defaultValue: "Contract intelligence insights",
            })}
            className="space-y-3 pt-4"
          >
            <header className="flex items-center gap-3 border-b border-border pb-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-plum/10 text-plum">
                <Brain className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-ink">
                  {t("dashboards.executive.sections.ecip.title", {
                    defaultValue: "Contract Intelligence",
                  })}
                </h2>
                <p className="text-xs text-ink-subtle">
                  {t("dashboards.executive.sections.ecip.subtitle", {
                    defaultValue:
                      "Risk signals, AI insights and financial intelligence.",
                  })}
                </p>
              </div>
            </header>

            {/* High-risk contracts — promoted to full-width dedicated section
                (was buried in a 3-col with templates+amendments). Prefers
                the mig 560 side-car (counterpartyName + riskType columns);
                falls back to the legacy slice while the side-car query is
                in flight. */}
            {(highRiskExtended && highRiskExtended.length > 0) ? (
              <HighRiskContractsCard rows={highRiskExtended} />
            ) : data.lists ? (
              <HighRiskContractsCard rows={data.lists.highRiskContracts8} />
            ) : null}

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
          </section>

          {/* E-rev-C-1: AVaR section hidden per executive review feedback. */}
        </>
      )}
    </motion.div>
  );
}

function ExpiryCliffsBlock({ cliffs }: { cliffs: ExecutiveExpiryCliffs }) {
  const { t } = useTranslation();
  // Single-frame state — clicking the open tile closes; clicking a different
  // tile swaps to that one. We never show two frames stacked.
  const [openCliff, setOpenCliff] = useState<30 | 60 | 90 | null>(null);
  const max = Math.max(cliffs.next30d, cliffs.next60d, cliffs.next90d, 1);
  const items = [
    {
      key: "next30d" as const,
      label: t("dashboards.executive.expiryCliffs.next30d"),
      count: cliffs.next30d,
      bg: "bg-terracotta",
      tint: "bg-terracotta/15",
      days: 30 as const,
    },
    {
      key: "next60d" as const,
      label: t("dashboards.executive.expiryCliffs.next60d"),
      count: cliffs.next60d,
      bg: "bg-amber",
      tint: "bg-amber/15",
      days: 60 as const,
    },
    {
      key: "next90d" as const,
      label: t("dashboards.executive.expiryCliffs.next90d"),
      count: cliffs.next90d,
      bg: "bg-sage",
      tint: "bg-sage/15",
      days: 90 as const,
    },
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((it) => {
          const pct = (it.count / max) * 100;
          const isOpen = openCliff === it.days;
          return (
            <button
              key={it.key}
              type="button"
              aria-expanded={isOpen}
              aria-controls="expiry-cliff-frame"
              onClick={() =>
                setOpenCliff((prev) => (prev === it.days ? null : it.days))
              }
              className={cn(
                `w-full rounded-md border bg-clip-padding p-3 text-left transition`,
                it.tint,
                "border-border hover:border-ink/30 hover:shadow-sm",
                isOpen && "ring-2 ring-ink/30",
              )}
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
              <p className="mt-1 text-[10px] text-ink-subtle">
                {t("dashboards.executive.expiryCliffs.clickHint", { defaultValue: "Click to act" })}
              </p>
            </button>
          );
        })}
      </div>
      {openCliff !== null && (
        <div id="expiry-cliff-frame" className="mt-3">
          <ExpiryCliffFrame
            key={openCliff}
            windowDays={openCliff}
            onClose={() => setOpenCliff(null)}
          />
        </div>
      )}
    </>
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
            width={170}
            interval={0}
            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
            tickMargin={6}
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th className="w-8 py-2" aria-hidden></th>
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
            const name =
              isAr && row.counterpartyNameAr
                ? row.counterpartyNameAr
                : row.counterpartyName;
            const isExpanded = expandedId === row.counterpartyId;
            return (
              <Fragment key={row.counterpartyId}>
                <tr
                  className={cn(
                    "border-t border-border/60 cursor-pointer transition-colors",
                    isExpanded ? "bg-surface" : "hover:bg-surface/60",
                  )}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : row.counterpartyId)
                  }
                  aria-expanded={isExpanded}
                >
                  <td className="py-2 ps-2 pe-1 align-top">
                    <button
                      type="button"
                      aria-label={t(
                        isExpanded
                          ? "dashboards.executive.topCounterparties.collapseAria"
                          : "dashboards.executive.topCounterparties.expandAria",
                        {
                          defaultValue: isExpanded
                            ? "Hide contracts"
                            : "Show contracts",
                        },
                      )}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-ink-subtle hover:bg-muted hover:text-ink"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </td>
                  <td className="py-2 pe-3">
                    {name ? (
                      <>
                        <span className="text-sm font-medium text-ink">
                          {name}
                        </span>
                        {row.counterpartyEmirate && (
                          <span className="ms-2 inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-subtle">
                            {humanizeLabelLocalized(row.counterpartyEmirate, i18n.language)}
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
                {isExpanded && (
                  <tr className="bg-surface/40">
                    <td colSpan={5} className="px-3 py-2">
                      <CounterpartyContractsDrill
                        counterpartyId={row.counterpartyId}
                        displayName={name ?? `ID #${row.counterpartyId}`}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CounterpartyContractsDrill({
  counterpartyId,
  displayName,
}: {
  counterpartyId: number;
  displayName: string;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["executive-top-counterparty-contracts", counterpartyId],
    queryFn: () => topCounterpartyService.contracts(counterpartyId),
    staleTime: 60_000,
  });
  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-xs text-destructive">
        {t("dashboards.executive.topCounterparties.drillLoadFailed", {
          defaultValue: "Could not load contracts.",
        })}
      </p>
    );
  }
  const rows = data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-xs italic text-ink-subtle">
        {t("dashboards.executive.topCounterparties.drillEmpty", {
          defaultValue: "No active contracts for this partner.",
        })}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-ink-subtle">
            <th className="px-2 py-2">
              {t("dashboards.executive.topCounterparties.drill.col.contract", {
                defaultValue: "Contract #",
              })}
            </th>
            <th className="px-2 py-2">
              {t("dashboards.executive.topCounterparties.drill.col.title", {
                defaultValue: "Title",
              })}
            </th>
            <th className="px-2 py-2">
              {t("dashboards.executive.topCounterparties.drill.col.counterparty", {
                defaultValue: "Counterparty",
              })}
            </th>
            <th className="px-2 py-2 text-right">
              {t("dashboards.executive.topCounterparties.drill.col.value", {
                defaultValue: "Value",
              })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.contractId} className="border-b border-border/40">
              <td className="px-2 py-1.5">
                <Link
                  to="/app/contracts/$id"
                  params={{ id: r.contractId }}
                  className="font-mono text-[11px] text-gold hover:underline"
                >
                  {r.contractNumber}
                </Link>
              </td>
              <td className="px-2 py-1.5">
                <Link
                  to="/app/contracts/$id"
                  params={{ id: r.contractId }}
                  className="text-sm text-ink hover:underline"
                >
                  {r.titleEn ?? r.titleAr ?? "—"}
                </Link>
              </td>
              <td className="px-2 py-1.5 text-sm text-ink">
                {r.counterpartyName ?? displayName}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-sm text-ink">
                {r.valueAed != null && Number(r.valueAed) > 0
                  ? formatAedCompact(Number(r.valueAed))
                  : "—"}
              </td>
            </tr>
          ))}
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
            // Tooltip should match the Y-axis style — compact AED (22B/45M)
            // instead of the long "AED 22,000,000,000".
            formatter={(v: number) => formatAedCompact(Number(v))}
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

// ─── RiskTriageTile (Phase B) ─────────────────────────────────────────
/**
 * Counter tile for borderline risk-case alerts (Tier-2) that the engine
 * routed to the executive for manual judgement. Reuses the same list
 * endpoint the /app/exec/risk-triage page consumes — derives openCount +
 * oldestAgeDays client-side so we don't add a new BE endpoint. Click
 * navigates to the queue itself. Stays a neutral tile when zero so it
 * doesn't compete with Critical Impact for attention.
 */
function RiskTriageTile() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["riskTriageSummary"],
    queryFn: () =>
      import("@/services/api/risk-review.service").then((m) =>
        m.riskReviewService.list(50),
      ),
    staleTime: 60_000,
  });
  const rows = data?.rows ?? [];
  const openCount = rows.length;
  const oldestAgeDays = useMemo(() => {
    if (rows.length === 0) return null;
    const now = Date.now();
    let max = 0;
    for (const r of rows) {
      const ts = Date.parse(r.created_at);
      if (!Number.isFinite(ts)) continue;
      const ageDays = Math.floor((now - ts) / 86400000);
      if (ageDays > max) max = ageDays;
    }
    return max;
  }, [rows]);
  const helper =
    oldestAgeDays != null && openCount > 0
      ? t("dashboards.executive.kpis.riskTriageOldest", {
          defaultValue: "Oldest {{n}}d",
          n: oldestAgeDays,
        })
      : undefined;
  return (
    <Link
      to="/app/exec/risk-triage"
      aria-label={t("dashboards.executive.kpis.openRiskTriageAria", {
        defaultValue: "Open Risk Triage ({{count}} pending)",
        count: openCount,
      })}
      className="block h-full w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-lg"
    >
      <KpiTile
        label={t("dashboards.executive.kpis.riskTriage", {
          defaultValue: "Risk Triage",
        })}
        value={formatNumber(openCount)}
        helper={helper}
        variant={openCount > 0 ? "risk" : "default"}
        className="h-full"
      />
    </Link>
  );
}

// ─── CriticalImpactTile ────────────────────────────────────────────────
/**
 * KPI-tile button that toggles the inline Critical Impact frame open or
 * closed. Renders the merged count (osint_signal severity=critical + open
 * critical risk_case rows) — falls back to the executive dashboard's own
 * openRegulatoryImpactsCritical count until the merged query resolves so
 * the tile never flashes to zero on first render.
 */
function CriticalImpactTile({
  fallbackCount,
  open,
  onToggle,
}: {
  fallbackCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["executiveCriticalImpacts", 7],
    queryFn: () => criticalImpactService.list({ windowDays: 7 }),
    staleTime: 60_000,
  });
  const displayCount = data?.rows.length ?? fallbackCount;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="critical-impact-frame"
      aria-label={t("dashboards.executive.kpis.openCriticalImpactsAria", {
        defaultValue: "Toggle {{count}} critical impact(s)",
        count: displayCount,
      })}
      className="block h-full w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-lg"
    >
      <KpiTile
        label={t("dashboards.executive.kpis.openCriticalImpacts", {
          defaultValue: "Critical impact",
        })}
        value={formatNumber(displayCount)}
        variant={displayCount > 0 ? "risk" : "default"}
        className="h-full"
      />
    </button>
  );
}

// ─── CriticalImpactFrame ───────────────────────────────────────────────
/**
 * Inline collapsible frame that opens below the KPI strip when the
 * Critical Impact tile is clicked. Renders the merged osint_signal +
 * risk_case feed; each row can be expanded to drill into the affected
 * contracts (number / title / counterparty / value) — those contract
 * numbers + titles link to /app/contracts/:id. RSS-sourced rows carry a
 * "Verify source" external link; internal:harness + risk_case rows omit
 * the link since no public URL exists.
 */
function CriticalImpactFrame({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["executiveCriticalImpacts", 7],
    queryFn: () => criticalImpactService.list({ windowDays: 7 }),
    staleTime: 60_000,
    enabled: open,
  });
  const rows = data?.rows ?? [];

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          id="critical-impact-frame"
          aria-label={t("dashboards.executive.criticalImpactsFrame.regionLabel", {
            defaultValue: "Critical impact details",
          })}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <header className="flex items-baseline justify-between gap-3 border-b border-border p-4">
            <h3 className="text-sm font-semibold text-ink">
              {t("dashboards.executive.criticalImpactsFrame.title", {
                defaultValue: "Critical impact",
              })}
            </h3>
            <p className="text-xs text-ink-subtle">
              {t("dashboards.executive.criticalImpactsFrame.subtitle", {
                defaultValue:
                  "Live critical signals + open critical risk cases (last 7 days)",
              })}
            </p>
          </header>
          <div className="p-4">
            {isLoading && (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            )}
            {isError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {(error as Error)?.message ??
                  t("common.error", { defaultValue: "Failed to load impacts." })}
              </div>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-muted">
                {t("dashboards.executive.criticalImpactsFrame.empty", {
                  defaultValue: "No critical impacts in the last 7 days.",
                })}
              </p>
            )}
            {!isLoading && !isError && rows.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {rows.map((row) => (
                  <CriticalImpactRowItem key={`${row.kind}:${row.id}`} row={row} />
                ))}
              </ul>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

// ─── CriticalImpactRowItem ─────────────────────────────────────────────
/**
 * Single row in the Critical Impact frame. Collapsed view shows the
 * impact metadata; expanding reveals the affected-contracts table.
 * Rows with zero contracts cannot be expanded (the chevron is omitted).
 */
function CriticalImpactRowItem({ row }: { row: CriticalImpactRow }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const canExpand = row.contracts.length > 0;
  const safeUrl =
    row.sourceUrl &&
    (row.sourceUrl.startsWith("https://") || row.sourceUrl.startsWith("http://"))
      ? row.sourceUrl
      : null;

  return (
    <li className="p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={t(
            expanded
              ? "dashboards.executive.criticalImpactsFrame.collapseRowAria"
              : "dashboards.executive.criticalImpactsFrame.expandRowAria",
            { defaultValue: expanded ? "Hide affected contracts" : "Show affected contracts" },
          )}
          disabled={!canExpand}
          className={cn(
            "mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-subtle",
            canExpand
              ? "hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              : "opacity-30",
          )}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <div className="flex-1">
          {/* 2026-06-04 — title row dropped per executive feedback. The
              upstream sources (hand-curated demo copy, RSS article
              titles, analyst-typed case titles) don't produce a
              consistently scannable label in production, so we lead with
              the rule-based risk type pill + criticality and let the
              description carry the narrative. */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <RiskTypePill type={row.riskType} />
            <span className="rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-terracotta">
              {row.criticality}
            </span>
          </div>
          {row.description && (
            <p className="mb-2 text-sm text-ink-muted">{row.description}</p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
            <span>
              {/* Prefer the registry's display_name (e.g. "OFAC SDN List")
                  over the raw slug (e.g. "OFAC_SDN") when available. Slug
                  rendered uppercase + mono as a stable fallback for
                  internal sources that haven't been registered. */}
              {row.sourceDisplayName ? (
                <span className="font-medium text-ink">{row.sourceDisplayName}</span>
              ) : (
                <span className="font-mono uppercase">{row.source}</span>
              )}
              {" · "}
              {row.category}
            </span>
            <span>
              {t("dashboards.executive.criticalImpactsFrame.contractCount", {
                defaultValue: "{{n}} contract(s) affected",
                n: row.contractsAffected,
              })}
            </span>
            <span>
              {t("dashboards.executive.criticalImpactsFrame.occurredAt", {
                defaultValue: "occurred {{when}}",
                when: formatDateTime(row.occurredAt),
              })}
            </span>
            {safeUrl && (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded"
              >
                {t("dashboards.executive.criticalImpactsFrame.verifySource", {
                  defaultValue: "Verify source",
                })}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
          {expanded && canExpand && (
            <CriticalImpactContractsTable contracts={row.contracts} />
          )}
        </div>
      </div>
    </li>
  );
}

// ─── CriticalImpactContractsTable ──────────────────────────────────────
/**
 * Drill-down table inside an expanded row. Each contract number + title
 * link to the contract detail page so the executive can investigate
 * without leaving the dashboard.
 */
function CriticalImpactContractsTable({
  contracts,
}: {
  contracts: CriticalImpactRow["contracts"];
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-border bg-paper-2">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/40 text-ink-subtle">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              {t("dashboards.executive.criticalImpactsFrame.colContractNumber", {
                defaultValue: "Contract #",
              })}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              {t("dashboards.executive.criticalImpactsFrame.colTitle", {
                defaultValue: "Title",
              })}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              {t("dashboards.executive.criticalImpactsFrame.colCounterparty", {
                defaultValue: "Counterparty",
              })}
            </th>
            <th scope="col" className="px-3 py-2 text-end font-semibold">
              {t("dashboards.executive.criticalImpactsFrame.colValue", {
                defaultValue: "Value",
              })}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contracts.map((c) => {
            const value =
              c.valueAed == null
                ? "—"
                : formatAedCompact(
                    typeof c.valueAed === "string" ? Number(c.valueAed) : c.valueAed,
                  );
            return (
              <tr key={c.id}>
                <td className="px-3 py-2">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: c.id }}
                    className="font-mono text-gold hover:underline"
                  >
                    {c.contractNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: c.id }}
                    className="text-ink hover:text-gold hover:underline"
                  >
                    {c.titleEn ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink-muted">{c.counterpartyName ?? "—"}</td>
                <td className="px-3 py-2 text-end text-ink">{value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ExecutiveDashboard;
