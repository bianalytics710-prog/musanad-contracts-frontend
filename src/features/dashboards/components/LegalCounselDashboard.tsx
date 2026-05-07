/**
 * LegalCounselDashboard — R-LC1 rebuild for full Lovable parity.
 *
 * Replaces the M_parity S4 regulatory-only layout with the rich
 * legal-counsel surface from Lovable: contracts-led KPIs, my-approval-queue
 * card, risk-exposure card (AI-risk donut + avg-review-time chart + top-5
 * risk list), regulatory-updates 12-week chart by authority, contract-types
 * donut, obligations-at-risk card, and activity feed with filter pills.
 *
 *   GET /api/v1/dashboards/legal-counsel?windowDays=N (fn_dashboard_legal_counsel
 *   extended in BE migration 071/072).
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  Flag,
  PieChart as PieIcon,
  ScrollText,
  Shield,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLegalCounselDashboard } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  KpiTile,
  TimeRangeSelector,
  asWindowQuery,
  formatNumber,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import { useAuthStore, selectUser } from "@/store/auth.store";
import { formatDate, formatHijriDate } from "@/utils/datetime";
import type {
  DashboardOpenImpactRow,
  DashboardRangeKey,
  DashboardRegulatoryUpdateRow,
  LegalCounselApprovalQueueRow,
  LegalCounselObligationRow,
  LegalCounselTopRiskRow,
  LegalCounselWeeklyAuthority,
  LegalCounselWeekHours,
  LegalCounselContractTypeRow,
  LegalCounselActivityRow,
} from "@/types/entities/dashboards.types";

const DEFAULT_WINDOW_DAYS = 30;

const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-terracotta-tint text-terracotta-ink",
  high: "bg-amber-tint text-amber-ink",
  medium: "bg-amber-tint/60 text-amber-ink",
  low: "bg-sage-tint text-sage-ink",
  unknown: "bg-muted text-ink-muted",
};

function severityClass(severity: string): string {
  return SEVERITY_TONE[severity.toLowerCase()] ?? SEVERITY_TONE.unknown;
}

// AI-risk donut palette (matches FE riskScore tints).
const RISK_FILL = {
  low: "#86A89B",
  medium: "#D9B26A",
  high: "#C4634D",
} as const;

// Authority palette for the regulatory-updates 12-week chart.
const AUTHORITY_FILL: Record<string, string> = {
  MoHRE: "#C68A3A",
  FTA: "#86A89B",
  CBUAE: "#5A6B7C",
  DIFC: "#7A8FA6",
  ADGM: "#7A8FA6",
  TDRA: "#A28BB7",
  MoJ: "#C4634D",
  MoE: "#9F7C39",
  default: "#5A6B7C",
};
function authorityFill(code: string | null): string {
  if (!code) return AUTHORITY_FILL.default;
  return AUTHORITY_FILL[code] ?? AUTHORITY_FILL.default;
}

// Activity feed filter pills (R-LC1 LC-C14 — Lovable parity).
type ActivityFilter = "all" | "mine" | "mentions" | "high";

export function LegalCounselDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const { data, isLoading, isError, error, refetch } = useLegalCounselDashboard(
    asWindowQuery(windowDays),
  );

  const topCriticalImpact = useMemo(
    () =>
      (data?.lists.openImpacts5 ?? []).find(
        (r) => r.severity?.toLowerCase() === "critical",
      ) ?? null,
    [data],
  );

  const riskDonut = useMemo(() => {
    if (!data?.risk) return [] as Array<{ key: string; count: number; fill: string }>;
    return [
      { key: "low", count: data.risk.lowCount, fill: RISK_FILL.low },
      { key: "medium", count: data.risk.mediumCount, fill: RISK_FILL.medium },
      { key: "high", count: data.risk.highCount, fill: RISK_FILL.high },
    ];
  }, [data]);

  const reviewChartData = useMemo(() => {
    return [...(data?.avgReview12w ?? [])]
      .sort((a, b) => b.weekIndex - a.weekIndex)
      .map((row) => ({
        week: `W${12 - row.weekIndex}`,
        hours: row.avgHours,
      }));
  }, [data]);

  const currentWeekReviewHours = useMemo(() => {
    const w0 = (data?.avgReview12w ?? []).find((r) => r.weekIndex === 0);
    return w0 ? w0.avgHours : 0;
  }, [data]);

  // Regulatory updates 12-week — group by week, stack by authority.
  const regChartData = useMemo(() => {
    const byWeek: Record<number, Record<string, number>> = {};
    const authoritiesSet = new Set<string>();
    (data?.regulatoryUpdates12w?.weeklyByAuthority ?? []).forEach((row) => {
      const wk = row.weekIndex;
      const auth = row.authority ?? "Other";
      authoritiesSet.add(auth);
      byWeek[wk] = byWeek[wk] ?? {};
      byWeek[wk][auth] = (byWeek[wk][auth] ?? 0) + row.count;
    });
    const rows = Array.from({ length: 12 }, (_, i) => i)
      .reverse()
      .map((wk) => ({
        week: `W${12 - wk}`,
        ...byWeek[wk],
      }));
    return { rows, authorities: Array.from(authoritiesSet) };
  }, [data]);

  const peakRegWeek = useMemo(() => {
    const counts = (data?.regulatoryUpdates12w?.weeklyByAuthority ?? []).reduce(
      (acc, r) => {
        acc[r.weekIndex] = (acc[r.weekIndex] ?? 0) + r.count;
        return acc;
      },
      {} as Record<number, number>,
    );
    let bestWeek = 0;
    let bestCount = 0;
    for (const [wk, c] of Object.entries(counts)) {
      if (c > bestCount) {
        bestCount = c;
        bestWeek = Number(wk);
      }
    }
    return { weekLabel: `W${12 - bestWeek}`, count: bestCount };
  }, [data]);

  // Activity-feed filter — basic client-side.
  const filteredActivity = useMemo(() => {
    const all = data?.activityFeed ?? [];
    switch (activityFilter) {
      case "mine":
        return user ? all.filter((a) => a.actorUserId === user.id) : [];
      case "mentions":
        // M_parity stub — no mentions wiring yet; show empty.
        return [];
      case "high":
        // Treat AI risk + critical regulatory + escalations as "high-priority".
        return all.filter((a) =>
          [
            "ai_risk_score_updated",
            "approval_escalated",
            "regulatory_impact_detected",
            "fully_executed",
          ].includes(a.activityType),
        );
      default:
        return all;
    }
  }, [data, activityFilter, user]);

  const nowISO = new Date().toISOString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6 p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* R-LC1 LC-C1 — welcome line with Hijri date (mirror approver R5c). */}
          <p className="text-xs text-ink-subtle">
            {user
              ? `${t("dashboards.common.welcome", { defaultValue: "Welcome back" })}, ${user.firstName} ${user.lastName} · ${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`
              : `${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`}
          </p>
          {/* R-LC1 LC-C2 — H1 wording: "Legal insights" (Lovable parity). */}
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("dashboards.legalCounsel.title", { defaultValue: "Legal insights" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.legalCounsel.subtitle")}
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
        <DashboardLoadingSkeleton rows={1} />
      ) : isError ? (
        <DashboardErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackKey="dashboards.legalCounsel.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* Hot regulation banner */}
          {topCriticalImpact && (
            <Link
              to="/app/regulatory-radar"
              className="relative block overflow-hidden rounded-xl border border-terracotta bg-terracotta/10 p-5 transition-colors hover:bg-terracotta/20"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="font-mono text-xs uppercase tracking-wider text-terracotta">
                    {t("dashboards.legalCounsel.hero.kicker", {
                      defaultValue: "Critical regulatory impact",
                    })}
                  </div>
                  <div className="mt-1 text-lg font-semibold leading-tight text-ink md:text-xl">
                    {topCriticalImpact.regulationTitleEn}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-0.5 font-mono">
                      {topCriticalImpact.contractNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-0.5 font-mono">
                      {data.kpis.openRegulatoryImpacts}{" "}
                      {t("dashboards.legalCounsel.hero.openImpacts", {
                        defaultValue: "open regulatory impacts",
                      })}
                    </span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-sm font-medium text-card">
                    {t("dashboards.legalCounsel.hero.openRadar", {
                      defaultValue: "Open Radar",
                    })}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </div>
                </div>
                <AlertTriangle className="h-12 w-12 text-terracotta" />
              </div>
            </Link>
          )}

          {/* R-LC1 LC-C4/C5/C6 — contracts-led KPIs (top row, clickable). */}
          <section
            aria-label={t("dashboards.legalCounsel.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Link to="/app/contracts" className="block">
              <KpiTile
                label={t("dashboards.legalCounsel.kpis.activeContracts", {
                  defaultValue: "Active",
                })}
                value={formatNumber(data.kpis.activeContracts)}
              />
            </Link>
            <Link to="/app/contracts" className="block">
              <KpiTile
                label={t("dashboards.legalCounsel.kpis.expiringIn30d", {
                  defaultValue: "Expiring 30d",
                })}
                value={formatNumber(data.kpis.expiringIn30d)}
                variant={data.kpis.expiringIn30d > 0 ? "warning" : "default"}
              />
            </Link>
            <Link to="/app/regulatory-radar" className="block">
              <KpiTile
                label={t("dashboards.legalCounsel.kpis.openRegulatoryImpacts", {
                  defaultValue: "Regulatory impact (open)",
                })}
                value={formatNumber(data.kpis.openRegulatoryImpacts)}
                variant={data.kpis.openRegulatoryImpacts > 0 ? "warning" : "default"}
              />
            </Link>
            <Link to="/app/approvals" className="block">
              <KpiTile
                label={t("dashboards.legalCounsel.kpis.pendingReview", {
                  defaultValue: "Pending Review",
                })}
                value={formatNumber(data.kpis.pendingReview)}
                variant={data.kpis.pendingReview > 0 ? "warning" : "default"}
              />
            </Link>
          </section>

          {/* My approval queue + Risk exposure side-by-side */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* My approval queue — 5-row table with Review buttons */}
            <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <Briefcase className="h-4 w-4 text-gold" />
                  {t("dashboards.legalCounsel.approvalQueue.title", {
                    defaultValue: "My approval queue",
                  })}
                </h3>
                <Link
                  to="/app/approvals"
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
                >
                  {t("dashboards.common.viewAll", { defaultValue: "View all →" })}
                </Link>
              </div>
              <ApprovalQueueTable rows={data.approvalQueue5} />
            </section>

            {/* Risk exposure — donut + avg-review chart + top-5 list */}
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.legalCounsel.risk.title", {
                    defaultValue: "Risk exposure",
                  })}
                </h3>
              </div>
              <p className="text-xs text-ink-subtle">
                {t("dashboards.legalCounsel.risk.subtitle", {
                  defaultValue: "Active contracts by AI risk score",
                })}
              </p>
              <div className="relative h-44">
                {data.risk.totalActive === 0 ? (
                  <DashboardEmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDonut}
                        dataKey="count"
                        nameKey="key"
                        innerRadius={42}
                        outerRadius={66}
                        paddingAngle={2}
                        stroke="var(--card)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {riskDonut.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-xl font-semibold text-ink">
                    {data.risk.totalActive}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
                    {t("dashboards.legalCounsel.risk.totalActive", {
                      defaultValue: "Total active",
                    })}
                  </span>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                <RiskLegendRow
                  label={t("dashboards.legalCounsel.risk.bucketLow", {
                    defaultValue: "Low (0–30)",
                  })}
                  count={data.risk.lowCount}
                  fill={RISK_FILL.low}
                />
                <RiskLegendRow
                  label={t("dashboards.legalCounsel.risk.bucketMedium", {
                    defaultValue: "Medium (31–60)",
                  })}
                  count={data.risk.mediumCount}
                  fill={RISK_FILL.medium}
                />
                <RiskLegendRow
                  label={t("dashboards.legalCounsel.risk.bucketHigh", {
                    defaultValue: "High (61+)",
                  })}
                  count={data.risk.highCount}
                  fill={RISK_FILL.high}
                />
              </ul>
              <div className="mt-4 border-t border-border/60 pt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
                  <span>
                    {t("dashboards.legalCounsel.risk.avgReview", {
                      defaultValue: "Avg legal review time",
                    })}
                  </span>
                  <span className="font-mono text-ink">
                    {t("dashboards.legalCounsel.risk.currentWeek", {
                      defaultValue: "Current week",
                    })}
                    : {Math.round(currentWeekReviewHours)}h
                  </span>
                </div>
                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reviewChartData}>
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={1} />
                      <YAxis tick={{ fontSize: 10 }} width={28} />
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
                        dataKey="hours"
                        stroke={RISK_FILL.medium}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-3 border-t border-border/60 pt-3">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  {t("dashboards.legalCounsel.risk.top5Title", {
                    defaultValue: "Top 5 highest-risk contracts",
                  })}
                </p>
                <TopRiskList rows={data.risk.top5HighRisk} />
              </div>
            </section>
          </div>

          {/* Regulatory updates 12 weeks + Contract types donut */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
              <div className="mb-2 flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.legalCounsel.regUpdates12w.title", {
                    defaultValue: "Regulatory updates · 12 weeks",
                  })}
                </h3>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                <span>
                  {t("dashboards.legalCounsel.regUpdates12w.totalUpdates", {
                    defaultValue: "Total updates",
                  })}
                  : <span className="font-mono text-ink">{data.regulatoryUpdates12w.totalUpdates}</span>
                </span>
                <span>
                  {t("dashboards.legalCounsel.regUpdates12w.authoritiesActive", {
                    defaultValue: "Authorities active",
                  })}
                  : <span className="font-mono text-ink">{data.regulatoryUpdates12w.authoritiesActive}</span>
                </span>
                <span>
                  {t("dashboards.legalCounsel.regUpdates12w.peakWeek", {
                    defaultValue: "Peak week",
                  })}
                  : <span className="font-mono text-ink">
                    {peakRegWeek.weekLabel} · {peakRegWeek.count}
                  </span>
                </span>
              </div>
              {data.regulatoryUpdates12w.totalUpdates === 0 ? (
                <DashboardEmptyState />
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regChartData.rows}>
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={28} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                      {regChartData.authorities.map((auth) => (
                        <Bar
                          key={auth}
                          dataKey={auth}
                          stackId="a"
                          fill={authorityFill(auth)}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <ul className="mt-3 flex flex-wrap gap-3 text-xs">
                {regChartData.authorities.map((auth) => (
                  <li key={auth} className="inline-flex items-center gap-1.5 text-ink-muted">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: authorityFill(auth) }}
                    />
                    {auth}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.legalCounsel.contractTypes.title", {
                    defaultValue: "Contract types",
                  })}
                </h3>
              </div>
              <p className="mb-2 text-xs text-ink-subtle">
                {t("dashboards.legalCounsel.contractTypes.subtitle", {
                  defaultValue: "Active contracts by type",
                })}
              </p>
              <ContractTypesDonut rows={data.contractTypes.rows} total={data.contractTypes.total} />
            </section>
          </div>

          {/* Obligations at risk + Activity feed */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Flag className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.legalCounsel.obligations.title", {
                    defaultValue: "Obligations at risk",
                  })}
                </h3>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-terracotta" />
                  <span>
                    {data.obligations.overdueCount}{" "}
                    {t("dashboards.legalCounsel.obligations.overdue", {
                      defaultValue: "overdue",
                    })}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber" />
                  <span>
                    {data.obligations.dueThisWeekCount}{" "}
                    {t("dashboards.legalCounsel.obligations.dueWeek", {
                      defaultValue: "due this week",
                    })}
                  </span>
                </span>
              </div>
              <ObligationsAtRiskList rows={data.obligations.top5} />
              <Link
                to="/app/obligations"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
              >
                {t("dashboards.legalCounsel.obligations.viewAll", {
                  defaultValue: "View all obligations →",
                })}
              </Link>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <Clock className="h-4 w-4 text-gold" />
                  {t("dashboards.legalCounsel.activityFeed.title", {
                    defaultValue: "Activity feed",
                  })}
                </h3>
                <div className="inline-flex flex-wrap gap-1">
                  {(
                    [
                      { key: "all", labelKey: "all", defaultLabel: "All" },
                      { key: "mine", labelKey: "mine", defaultLabel: "My actions" },
                      { key: "mentions", labelKey: "mentions", defaultLabel: "Mentions" },
                      { key: "high", labelKey: "high", defaultLabel: "High-priority" },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setActivityFilter(p.key)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                        activityFilter === p.key
                          ? "bg-gold/20 text-gold"
                          : "text-ink-muted hover:bg-surface"
                      }`}
                    >
                      {t(`dashboards.legalCounsel.activityFeed.pill.${p.labelKey}`, {
                        defaultValue: p.defaultLabel,
                      })}
                    </button>
                  ))}
                </div>
              </div>
              <ActivityFeedList rows={filteredActivity} />
            </section>
          </div>

          {/* Existing recent regulatory updates + open impacts (kept for parity) */}
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {t("dashboards.legalCounsel.lists.recentRegulatoryUpdatesTitle")}
              </h3>
              <p className="mb-3 text-xs text-ink-subtle">
                {t(
                  "dashboards.legalCounsel.lists.recentRegulatoryUpdatesDescription",
                )}
              </p>
              <RegulatoryUpdateRows rows={data.lists.recentRegulatoryUpdates5} />
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {t("dashboards.legalCounsel.lists.openImpactsTitle")}
              </h3>
              <p className="mb-3 text-xs text-ink-subtle">
                {t("dashboards.legalCounsel.lists.openImpactsDescription")}
              </p>
              <OpenImpactRows rows={data.lists.openImpacts5} />
            </section>
          </div>
        </>
      )}
    </motion.div>
  );
}

function ApprovalQueueTable({ rows }: { rows: LegalCounselApprovalQueueRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <DashboardEmptyState
        description={t("dashboards.legalCounsel.approvalQueue.empty", {
          defaultValue: "No contracts pending your review",
        })}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
          <tr className="border-b border-border/60">
            <th className="py-1.5 text-start">
              {t("dashboards.legalCounsel.approvalQueue.col.contract", {
                defaultValue: "Contract",
              })}
            </th>
            <th className="py-1.5 text-start">
              {t("dashboards.legalCounsel.approvalQueue.col.type", {
                defaultValue: "Type",
              })}
            </th>
            <th className="py-1.5 text-start">
              {t("dashboards.legalCounsel.approvalQueue.col.drafter", {
                defaultValue: "Drafter",
              })}
            </th>
            <th className="py-1.5 text-start">
              {t("dashboards.legalCounsel.approvalQueue.col.submitted", {
                defaultValue: "Submitted",
              })}
            </th>
            <th className="py-1.5 text-end" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const drafterName = [r.drafterFirstName, r.drafterLastName].filter(Boolean).join(" ");
            return (
              <tr key={r.id} className="border-b border-border/40">
                <td className="py-2">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: String(r.contractId) }}
                    className="block transition-colors hover:bg-surface/50"
                  >
                    <div className="font-mono text-xs text-ink-muted">
                      {r.contractNumber}
                    </div>
                    <div className="text-sm text-ink">{r.titleEn}</div>
                  </Link>
                </td>
                <td className="py-2 text-xs text-ink-muted">
                  {t(`contractType.${r.contractType}`, { defaultValue: r.contractType })}
                </td>
                <td className="py-2 text-xs text-ink-muted">{drafterName || "—"}</td>
                <td className="py-2 font-mono text-xs text-ink-muted">
                  {r.submittedAt ? formatDate(r.submittedAt) : "—"}
                </td>
                <td className="py-2 text-end">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: String(r.contractId) }}
                    className="inline-flex items-center gap-1 rounded-md bg-gold px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-gold/90"
                  >
                    {t("dashboards.legalCounsel.approvalQueue.action.review", {
                      defaultValue: "Review",
                    })}
                    <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RiskLegendRow({
  label,
  count,
  fill,
}: {
  label: string;
  count: number;
  fill: string;
}) {
  return (
    <li className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-2 text-ink">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: fill }}
        />
        {label}
      </span>
      <span className="font-mono text-ink-muted">{count}</span>
    </li>
  );
}

function TopRiskList({ rows }: { rows: LegalCounselTopRiskRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <p className="text-xs text-ink-subtle">{t("dashboards.common.emptyList")}</p>;
  }
  return (
    <ul role="list" className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
          <Link
            to="/app/contracts/$id"
            params={{ id: String(r.id) }}
            className="block min-w-0 flex-1 truncate text-ink hover:underline"
          >
            <span className="font-mono text-ink-muted">{r.contractNumber}</span>{" "}
            <span className="text-ink">·</span>{" "}
            <span>{r.titleEn}</span>
          </Link>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${
              r.risk >= 60
                ? "bg-terracotta-tint text-terracotta-ink"
                : r.risk >= 30
                  ? "bg-amber-tint text-amber-ink"
                  : "bg-sage-tint text-sage-ink"
            }`}
          >
            {r.risk}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ContractTypesDonut({
  rows,
  total,
}: {
  rows: LegalCounselContractTypeRow[];
  total: number;
}) {
  const { t } = useTranslation();
  const palette = ["#C68A3A", "#86A89B", "#D9B26A", "#7A8FA6", "#A28BB7", "#9F7C39", "#5A6B7C", "#C4634D"];
  const data = rows.map((r, i) => ({
    type: t(`contractType.${r.type}`, { defaultValue: r.type }),
    count: r.count,
    pct: r.pct,
    fill: palette[i % palette.length],
  }));
  if (total === 0) return <DashboardEmptyState />;
  return (
    <>
      <div className="relative h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="type"
              innerRadius={36}
              outerRadius={56}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-semibold text-ink">{total}</span>
          <span className="text-[9px] uppercase tracking-wider text-ink-subtle">
            {t("dashboards.common.total", { defaultValue: "Total" })}
          </span>
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {data.map((d) => (
          <li key={d.type} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-ink">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: d.fill }}
              />
              {d.type}
            </span>
            <span className="font-mono text-ink-muted">{d.pct}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ObligationsAtRiskList({ rows }: { rows: LegalCounselObligationRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }
  return (
    <ul role="list" className="divide-y divide-border/50">
      {rows.map((r) => (
        <li key={r.id} className="py-2">
          <Link
            to="/app/contracts/$id"
            params={{ id: String(r.contractId) }}
            className="block transition-colors hover:bg-surface/50"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-ink">{r.titleEn}</span>
              {r.daysOverdue > 0 ? (
                <span className="inline-flex items-center rounded-full bg-terracotta-tint px-2 py-0.5 font-mono text-[10px] font-medium text-terracotta-ink">
                  {r.daysOverdue}{" "}
                  {t("dashboards.legalCounsel.obligations.daysOverdue", {
                    defaultValue: "days overdue",
                  })}
                </span>
              ) : r.daysLeft >= 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-tint px-2 py-0.5 font-mono text-[10px] font-medium text-amber-ink">
                  {r.daysLeft}{" "}
                  {t("dashboards.legalCounsel.obligations.daysLeft", {
                    defaultValue: "days left",
                  })}
                </span>
              ) : null}
            </div>
            <p className="font-mono text-[10px] text-ink-subtle">{r.contractNumber}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ActivityFeedList({ rows }: { rows: LegalCounselActivityRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }
  return (
    <ul role="list" className="space-y-2 text-sm">
      {rows.slice(0, 12).map((r) => (
        <li key={r.id} className="flex items-baseline gap-2">
          <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gold/60" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">
              {t(`dashboards.legalCounsel.activityFeed.type.${r.activityType}`, {
                defaultValue: r.description,
              })}
            </p>
            <p className="text-[10px] text-ink-subtle">
              {formatDate(r.createdAt)}
              {" · "}
              <Link
                to="/app/contracts/$id"
                params={{ id: String(r.contractId) }}
                className="text-gold hover:underline"
              >
                {r.contractNumber}
              </Link>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RegulatoryUpdateRows({
  rows,
}: {
  rows: DashboardRegulatoryUpdateRow[];
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }
  return (
    <ul role="list" className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} role="listitem" className="flex items-start gap-3 py-2">
          <span
            className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${severityClass(row.severity)}`}
          >
            {t(`dashboards.common.severity.${row.severity}`, {
              defaultValue: row.severity,
            })}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">{row.titleEn}</p>
            <p className="text-[11px] text-ink-muted">
              {row.regulator?.nameEn ?? ""}
              {row.effectiveDate && (
                <>
                  {" · "}
                  {t("dashboards.common.effective")}: {formatDate(row.effectiveDate)}
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function OpenImpactRows({ rows }: { rows: DashboardOpenImpactRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }
  return (
    <ul role="list" className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} role="listitem" className="py-2">
          <Link
            to="/app/contracts/$id"
            params={{ id: String(row.contractId) }}
            className="block rounded-md px-2 py-1 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={t("dashboards.common.openContractAria", {
              number: row.contractNumber,
              title: row.regulationTitleEn,
            })}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs text-ink-subtle">
                {row.contractNumber}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${severityClass(row.severity)}`}
              >
                {t(`dashboards.common.severity.${row.severity}`, {
                  defaultValue: row.severity,
                })}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink">{row.regulationTitleEn}</p>
            <p className="text-[11px] text-ink-muted">
              {t("dashboards.common.detected")}: {formatDate(row.detectedAt)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default LegalCounselDashboard;
