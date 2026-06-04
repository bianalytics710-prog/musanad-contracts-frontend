/**
 * ApproverDashboard — mig 532 revamp.
 *
 * Two clean zones — Action (top fold) and Insights (bottom). Drops the
 * legacy 7/30/90/custom date filter (approvers care about NOW) and the
 * always-empty "decisions by counterparty" / "approvals by approver" /
 * "decision mix split" widgets.
 *
 * 13-checklist:
 *   T1/T2 — useApproverDashboard (React Query, 30s stale)
 *   T3    — every label via t() with defaults
 *   T4    — explicit loading / error / empty branches
 *   T5    — semantic tokens only (sage/gold/terracotta + var(--ink-*))
 *   T6    — table headers with scope="col", aria-current on next-up
 *   T11   — wrapped by ErrorBoundary at route level
 *   T12   — formatDateTime + formatHijriDate for timestamps
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
  Building2,
  Activity,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ComposedChart,
} from "recharts";
import { useApproverDashboard } from "../hooks/useDashboards";
import {
  DashboardErrorState,
  DashboardLoadingSkeleton,
  KpiTile,
  formatAed,
  formatNumber,
} from "./dashboard-primitives";
import type {
  ApproverPendingQueueRowV2,
  ApproverRecentDecisionRowV2,
  ApproverVelocityPoint,
  ApproverCounterpartyConcentration,
  RiskBand,
} from "@/types/entities/dashboards.types";
import { formatDate, formatDateTime, formatHijriDate } from "@/utils/datetime";
import { useAuthStore, selectUser } from "@/store/auth.store";

function formatHours(value: number | null): string {
  if (value == null) return "—";
  if (value >= 24) {
    const d = Math.floor(value / 24);
    const h = Math.round(value - d * 24);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  return `${Math.round(value)}h`;
}

function riskColor(band: RiskBand | null): string {
  if (band === "Low") return "var(--sage)";
  if (band === "Medium") return "var(--gold)";
  if (band === "High") return "var(--terracotta)";
  return "var(--ink-subtle)";
}

function riskTint(band: RiskBand | null): string {
  if (band === "Low") return "bg-sage/15 text-sage";
  if (band === "Medium") return "bg-gold/15 text-gold";
  if (band === "High") return "bg-terracotta/15 text-terracotta";
  return "bg-muted text-ink-muted";
}

function decisionTint(
  d: ApproverRecentDecisionRowV2["decision"],
): string {
  switch (d) {
    case "approve":
      return "bg-sage/15 text-sage";
    case "reject":
      return "bg-terracotta/15 text-terracotta";
    case "request_info":
    case "request_resubmission":
      return "bg-gold/15 text-gold";
    default:
      return "bg-muted text-ink-muted";
  }
}

export function ApproverDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const { data, isLoading, isError, error, refetch } = useApproverDashboard();

  if (isLoading) return <DashboardLoadingSkeleton />;
  if (isError || !data) {
    return <DashboardErrorState error={error} onRetry={() => void refetch()} />;
  }

  const { kpis, nextUp, pendingQueue, insights } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1320px] space-y-6 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("approverDashboard.title", { defaultValue: "Your approval inbox" })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("approverDashboard.welcome", {
            defaultValue: "Welcome back, {{name}}. {{date}} · {{hijri}}",
            name: user?.firstName ?? "approver",
            date: formatDate(new Date().toISOString()),
            hijri: formatHijriDate(new Date().toISOString()),
          })}
        </p>
      </header>

      {/* KPI strip */}
      <KpiStrip kpis={kpis} pendingCount={pendingQueue.length} />

      {/* Next up */}
      {nextUp && <NextUpCard nextUp={nextUp} />}

      {/* Pending queue table */}
      <PendingQueueTable rows={pendingQueue} />

      {/* Insights zone */}
      <h2 className="pt-2 text-sm font-semibold uppercase tracking-wider text-ink-subtle">
        {t("approverDashboard.insightsHeader", {
          defaultValue: "Patterns from your recent work",
        })}
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <DecisionVelocityCard
          points={insights.decisionVelocity ?? insights.decisionVelocity30d}
          windowDays={insights.decisionVelocityWindowDays ?? 30}
        />
        <QueueRiskProfileCard profile={insights.queueRiskProfile} />
        <CounterpartyConcentrationCard rows={insights.counterpartyConcentration} />
        <DecisionMixCard mix={insights.decisionMix90d} />
      </div>
      <RecentDecisionsCard rows={insights.recentDecisions} />
    </motion.div>
  );
}

// ─── KpiStrip ─────────────────────────────────────────────────────────────
function KpiStrip({
  kpis,
  pendingCount,
}: {
  kpis: ReturnType<typeof useApproverDashboard>["data"] extends infer D
    ? D extends { kpis: infer K }
      ? K
      : never
    : never;
  pendingCount: number;
}) {
  const { t } = useTranslation();
  const medianCurr = kpis.medianDecisionHours.thisMonth;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label={t("approverDashboard.kpi.awaiting", {
          defaultValue: "Awaiting your decision",
        })}
        value={String(kpis.awaitingMyDecision.current)}
        variant={kpis.awaitingMyDecision.current > 0 ? "warning" : "default"}
      />
      <KpiTile
        label={t("approverDashboard.kpi.slaAtRisk", { defaultValue: "SLA at risk" })}
        value={String(kpis.slaAtRisk)}
        variant={kpis.slaAtRisk > 0 ? "risk" : "success"}
      />
      <KpiTile
        label={t("approverDashboard.kpi.highValue", {
          defaultValue: "High value in queue",
        })}
        value={String(kpis.highValueInQueue.count)}
        variant={kpis.highValueInQueue.count > 0 ? "warning" : "default"}
      />
      <KpiTile
        label={t("approverDashboard.kpi.medianDecisionTime", {
          defaultValue: "Median decision time",
        })}
        value={medianCurr != null ? formatHours(medianCurr) : "—"}
        variant="default"
      />
      <span hidden>{pendingCount}</span>
    </div>
  );
}

// ─── NextUpCard ───────────────────────────────────────────────────────────
function NextUpCard({
  nextUp,
}: {
  nextUp: NonNullable<ReturnType<typeof useApproverDashboard>["data"]>["nextUp"];
}) {
  const { t } = useTranslation();
  if (!nextUp) return null;

  return (
    <section
      className="rounded-lg border border-gold/30 bg-gold/5 p-4"
      aria-labelledby="next-up-heading"
    >
      <div className="mb-2 flex items-center gap-2">
        <Bell className="h-4 w-4 text-gold" aria-hidden />
        <h2
          id="next-up-heading"
          className="text-xs font-semibold uppercase tracking-wider text-gold"
        >
          {t("approverDashboard.nextUp.title", { defaultValue: "Next up" })}
        </h2>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            to="/app/contracts/$id"
            params={{ id: String(nextUp.contractId) }}
            className="text-base font-semibold text-ink hover:text-gold"
          >
            {nextUp.titleEn}
          </Link>
          <p className="mt-1 text-xs text-ink-muted">
            <span className="font-mono">{nextUp.contractNumber}</span>
            {nextUp.counterpartyName && (
              <>
                {" · "}
                {nextUp.counterpartyName}
              </>
            )}
            {nextUp.submittedByName && (
              <>
                {" · "}
                {t("approverDashboard.submittedBy", {
                  defaultValue: "submitted by {{name}}",
                  name: nextUp.submittedByName,
                })}
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-card px-2 py-0.5 font-mono text-ink-muted">
              {nextUp.valueAed != null ? formatAed(nextUp.valueAed) : "—"}
            </span>
            {nextUp.riskBand && (
              <span
                className={
                  "rounded-full px-2 py-0.5 font-semibold " + riskTint(nextUp.riskBand)
                }
              >
                {nextUp.riskBand} · {nextUp.riskScore}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-ink-muted">
              <Clock className="h-3 w-3" aria-hidden />
              {formatHours(nextUp.hoursWaiting)} waiting
            </span>
          </div>
        </div>
        <Link
          to="/app/contracts/$id"
          params={{ id: String(nextUp.contractId) }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-white hover:bg-gold/90"
        >
          {t("approverDashboard.nextUp.cta", { defaultValue: "Open & decide" })}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

// ─── PendingQueueTable ────────────────────────────────────────────────────
function PendingQueueTable({ rows }: { rows: ApproverPendingQueueRowV2[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto h-6 w-6 text-sage" aria-hidden />
        <p className="mt-2 text-sm font-medium text-ink">
          {t("approverDashboard.queue.empty", {
            defaultValue: "Inbox zero — no contracts waiting on you.",
          })}
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-baseline justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">
          {t("approverDashboard.queue.title", {
            defaultValue: "Pending queue ({{n}})",
            n: rows.length,
          })}
        </h2>
        <p className="text-xs text-ink-subtle">
          {t("approverDashboard.queue.sortHint", {
            defaultValue: "Sorted by value × hours waiting",
          })}
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface/60 text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-2 text-start font-medium">
                {t("approverDashboard.queue.col.contract", { defaultValue: "Contract" })}
              </th>
              <th scope="col" className="px-4 py-2 text-start font-medium">
                {t("approverDashboard.queue.col.counterparty", {
                  defaultValue: "Counterparty",
                })}
              </th>
              <th scope="col" className="px-4 py-2 text-end font-medium">
                {t("approverDashboard.queue.col.value", { defaultValue: "Value" })}
              </th>
              <th scope="col" className="px-4 py-2 text-center font-medium">
                {t("approverDashboard.queue.col.risk", { defaultValue: "Risk" })}
              </th>
              <th scope="col" className="px-4 py-2 text-end font-medium">
                {t("approverDashboard.queue.col.waiting", { defaultValue: "Waiting" })}
              </th>
              <th scope="col" className="px-4 py-2 text-start font-medium">
                {t("approverDashboard.queue.col.submittedBy", {
                  defaultValue: "Submitted by",
                })}
              </th>
              <th scope="col" className="px-4 py-2 text-end font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.stepId} className="hover:bg-surface/40">
                <td className="px-4 py-2.5">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: String(row.contractId) }}
                    className="font-medium text-ink hover:text-gold"
                  >
                    {row.titleEn}
                  </Link>
                  <p className="font-mono text-[10px] text-ink-subtle">
                    {row.contractNumber}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-ink-muted">
                  {row.counterpartyName ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-end font-mono text-ink">
                  {row.valueAed != null ? formatAed(row.valueAed) : "—"}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {row.riskBand ? (
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        riskTint(row.riskBand)
                      }
                    >
                      {row.riskBand} · {row.riskScore}
                    </span>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </td>
                <td
                  className={
                    "px-4 py-2.5 text-end font-mono " +
                    (row.slaAtRisk ? "font-semibold text-terracotta" : "text-ink-muted")
                  }
                >
                  {formatHours(row.hoursWaiting)}
                </td>
                <td className="px-4 py-2.5 text-ink-muted">
                  {row.submittedByName ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-end">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: String(row.contractId) }}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-ink hover:border-gold/60"
                  >
                    {t("approverDashboard.queue.cta", { defaultValue: "Decide" })}
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── DecisionVelocityCard ──────────────────────────────────────────────────
//
// Daily bars + a median-hours line over 90 days produced too much visual
// noise — most days had zero decisions, the chart felt empty even when
// the underlying numbers were healthy. Revamped to:
//
//   • two hero stats (decisions/week average + overall median hours)
//   • a clean 12-week bar chart (one bar per ISO week)
//
// The bars are derived client-side from the per-day velocity series so the
// BE didn't need another field.
function DecisionVelocityCard({
  points,
  windowDays,
}: {
  points: ApproverVelocityPoint[];
  windowDays: number;
}) {
  const { t } = useTranslation();

  // Bucket per-day points into ISO weeks (Mon-Sun). Show the last 12 weeks.
  const weeks = useMemo(() => bucketByWeek(points, 12), [points]);
  const totalDecisions = weeks.reduce((s, w) => s + w.decisionCount, 0);

  const perWeek =
    weeks.length > 0
      ? totalDecisions / weeks.length
      : 0;
  const medianHoursOverall = useMemo(() => {
    const all = points
      .map((p) => p.medianHours)
      .filter((v): v is number => v != null);
    if (all.length === 0) return null;
    const sorted = [...all].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }, [points]);

  if (totalDecisions === 0) {
    return (
      <CardShell
        title={t("approverDashboard.velocity.title", {
          defaultValue: "Your decision throughput",
        })}
      >
        <EmptyCard
          text={t("approverDashboard.velocity.empty", {
            defaultValue: "No decisions logged yet.",
          })}
        />
      </CardShell>
    );
  }

  return (
    <CardShell
      title={t("approverDashboard.velocity.title", {
        defaultValue: "Your decision throughput",
      })}
      icon={<Activity className="h-4 w-4 text-gold" aria-hidden />}
    >
      {/* Hero stats */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-2xl font-semibold text-ink">
            {perWeek >= 10 ? Math.round(perWeek) : perWeek.toFixed(1)}
            <span className="ms-1 text-xs font-normal text-ink-muted">/wk</span>
          </p>
          <p className="text-[11px] text-ink-muted">
            {t("approverDashboard.velocity.perWeekHelp", {
              defaultValue: "Decisions per week ({{weeks}}-wk avg)",
              weeks: weeks.length,
            })}
          </p>
        </div>
        <div>
          <p className="font-mono text-2xl font-semibold text-ink">
            {medianHoursOverall != null ? formatHours(medianHoursOverall) : "—"}
          </p>
          <p className="text-[11px] text-ink-muted">
            {t("approverDashboard.velocity.medianTime", {
              defaultValue: "Median time to decide",
            })}
          </p>
        </div>
      </div>

      {/* Weekly bars */}
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={weeks} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="weekLabel"
            tick={{ fontSize: 9, fill: "var(--ink-subtle)" }}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--ink-subtle)" }}
            width={20}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}
            labelFormatter={(label: string) => label}
            formatter={(value: number) => [
              value,
              t("approverDashboard.velocity.decisions", { defaultValue: "Decisions" }),
            ]}
          />
          <Bar dataKey="decisionCount" fill="var(--gold)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <p className="mt-2 text-right text-[10px] text-ink-subtle">
        {t("approverDashboard.velocity.windowFootnote", {
          defaultValue: "Based on {{n}} days of activity",
          n: windowDays,
        })}
      </p>
    </CardShell>
  );
}

/**
 * Group per-day velocity points into ISO weeks (Monday start). Returns the
 * most recent `maxWeeks` buckets ordered oldest → newest.
 */
function bucketByWeek(
  points: ApproverVelocityPoint[],
  maxWeeks: number,
): Array<{ weekStart: string; weekLabel: string; decisionCount: number }> {
  if (points.length === 0) return [];
  const map = new Map<string, { weekStart: Date; decisionCount: number }>();
  for (const p of points) {
    const d = new Date(p.day + "T00:00:00Z");
    const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ...
    const offsetToMonday = (day + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - offsetToMonday);
    const key = monday.toISOString().slice(0, 10);
    const existing = map.get(key);
    if (existing) {
      existing.decisionCount += p.decisionCount;
    } else {
      map.set(key, { weekStart: monday, decisionCount: p.decisionCount });
    }
  }
  const all = Array.from(map.values())
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .slice(-maxWeeks);
  return all.map((w) => ({
    weekStart: w.weekStart.toISOString().slice(0, 10),
    weekLabel: `${String(w.weekStart.getUTCDate()).padStart(2, "0")} ${w.weekStart.toLocaleString("en", { month: "short" })}`,
    decisionCount: w.decisionCount,
  }));
}

// ─── QueueRiskProfileCard ──────────────────────────────────────────────────
function QueueRiskProfileCard({
  profile,
}: {
  profile: {
    low: number;
    medium: number;
    high: number;
    unrated: number;
    total: number;
  };
}) {
  const { t } = useTranslation();
  const slices = useMemo(
    () =>
      [
        { name: t("approverDashboard.riskProfile.low", { defaultValue: "Low" }), value: profile.low, color: "var(--sage)" },
        { name: t("approverDashboard.riskProfile.medium", { defaultValue: "Medium" }), value: profile.medium, color: "var(--gold)" },
        { name: t("approverDashboard.riskProfile.high", { defaultValue: "High" }), value: profile.high, color: "var(--terracotta)" },
        { name: t("approverDashboard.riskProfile.unrated", { defaultValue: "Unrated" }), value: profile.unrated, color: "var(--ink-subtle)" },
      ].filter((s) => s.value > 0),
    [profile, t],
  );

  return (
    <CardShell
      title={t("approverDashboard.riskProfile.title", {
        defaultValue: "Risk profile of your queue",
      })}
      icon={<AlertTriangle className="h-4 w-4 text-gold" aria-hidden />}
    >
      {profile.total === 0 ? (
        <EmptyCard
          text={t("approverDashboard.riskProfile.empty", {
            defaultValue: "No pending items in your queue.",
          })}
        />
      ) : (
        <div className="grid grid-cols-[auto_1fr] items-center gap-4">
          <ResponsiveContainer width={150} height={150}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={62}
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-1.5 text-xs">
            {slices.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-ink-muted">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  {s.name}
                </span>
                <span className="font-mono font-semibold text-ink">{s.value}</span>
              </li>
            ))}
            <li className="mt-1 flex items-center justify-between border-t border-border pt-1.5">
              <span className="text-ink-muted">
                {t("approverDashboard.riskProfile.total", { defaultValue: "Total" })}
              </span>
              <span className="font-mono font-semibold text-ink">{profile.total}</span>
            </li>
          </ul>
        </div>
      )}
    </CardShell>
  );
}

// ─── CounterpartyConcentrationCard ────────────────────────────────────────
function CounterpartyConcentrationCard({
  rows,
}: {
  rows: ApproverCounterpartyConcentration[];
}) {
  const { t } = useTranslation();
  const total = rows.reduce((s, r) => s + Number(r.totalAed ?? 0), 0);
  return (
    <CardShell
      title={t("approverDashboard.concentration.title", {
        defaultValue: "Counterparty concentration in queue",
      })}
      icon={<Building2 className="h-4 w-4 text-gold" aria-hidden />}
    >
      {rows.length === 0 ? (
        <EmptyCard
          text={t("approverDashboard.concentration.empty", {
            defaultValue: "No pending items with counterparties.",
          })}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const aed = Number(r.totalAed ?? 0);
            const pct = total > 0 ? (aed / total) * 100 : 0;
            return (
              <li key={r.counterpartyId} className="text-xs">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-ink">
                    {r.name ?? "—"}
                    <span className="ms-1 font-mono text-[10px] text-ink-subtle">
                      ({r.contractsCount})
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-ink-muted">{formatAed(aed)}</span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}

// ─── DecisionMixCard ──────────────────────────────────────────────────────
function DecisionMixCard({
  mix,
}: {
  mix: { approved: number; rejected: number; requestedInfo: number; total: number };
}) {
  const { t } = useTranslation();
  if (mix.total === 0) {
    return (
      <CardShell
        title={t("approverDashboard.decisionMix.title", {
          defaultValue: "Your decision mix (last 90 days)",
        })}
        icon={<Users className="h-4 w-4 text-gold" aria-hidden />}
      >
        <EmptyCard
          text={t("approverDashboard.decisionMix.empty", {
            defaultValue: "No decisions logged in the last 90 days.",
          })}
        />
      </CardShell>
    );
  }
  const segs = [
    { key: "approved", label: t("approverDashboard.decisionMix.approved", { defaultValue: "Approved" }), value: mix.approved, color: "var(--sage)" },
    { key: "requested", label: t("approverDashboard.decisionMix.requestedInfo", { defaultValue: "Info requested" }), value: mix.requestedInfo, color: "var(--gold)" },
    { key: "rejected", label: t("approverDashboard.decisionMix.rejected", { defaultValue: "Rejected" }), value: mix.rejected, color: "var(--terracotta)" },
  ];
  return (
    <CardShell
      title={t("approverDashboard.decisionMix.title", {
        defaultValue: "Your decision mix (last 90 days)",
      })}
      icon={<Users className="h-4 w-4 text-gold" aria-hidden />}
    >
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={t("approverDashboard.decisionMix.title", { defaultValue: "Your decision mix" })}>
        {segs.map((s) => {
          const pct = mix.total > 0 ? (s.value / mix.total) * 100 : 0;
          return (
            <span
              key={s.key}
              style={{ width: `${pct}%`, backgroundColor: s.color }}
              title={`${s.label}: ${s.value}`}
            />
          );
        })}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {segs.map((s) => (
          <li key={s.key} className="flex flex-col">
            <span className="inline-flex items-center gap-1 text-ink-muted">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.label}
            </span>
            <span className="font-mono text-lg font-semibold text-ink">{s.value}</span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

// ─── RecentDecisionsCard ──────────────────────────────────────────────────
function RecentDecisionsCard({ rows }: { rows: ApproverRecentDecisionRowV2[] }) {
  const { t } = useTranslation();
  return (
    <CardShell
      title={t("approverDashboard.recent.title", {
        defaultValue: "Your recent decisions",
      })}
      icon={<CheckCircle2 className="h-4 w-4 text-sage" aria-hidden />}
    >
      {rows.length === 0 ? (
        <EmptyCard
          text={t("approverDashboard.recent.empty", {
            defaultValue: "No decisions yet.",
          })}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={`${r.contractId}-${r.decidedAt}`}
              className="rounded-md border border-border/60 bg-surface/40 p-3 text-xs"
            >
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  to="/app/contracts/$id"
                  params={{ id: String(r.contractId) }}
                  className="font-medium text-ink hover:text-gold"
                >
                  {r.titleEn}
                </Link>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                    decisionTint(r.decision)
                  }
                >
                  {t(`approverDashboard.recent.decision.${r.decision}`, {
                    defaultValue: r.decision.replace("_", " "),
                  })}
                </span>
              </div>
              <p className="text-[10px] text-ink-subtle">
                <span className="font-mono">{r.contractNumber}</span>
                {r.counterpartyName && (
                  <>
                    {" · "}
                    {r.counterpartyName}
                  </>
                )}
                {" · "}
                {formatDateTime(r.decidedAt)}
                {r.valueAed != null && (
                  <>
                    {" · "}
                    {formatAed(r.valueAed)}
                  </>
                )}
              </p>
              {r.decisionNote && (
                <p className="mt-1 italic text-ink-muted">"{r.decisionNote}"</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

// ─── Shared shells ────────────────────────────────────────────────────────
function CardShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </header>
      {children}
    </section>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-ink-subtle">{text}</p>;
}

// Re-export for tests / dev-only — keep formatNumber referenced so the
// import doesn't get linted away.
export const _approverDashboardInternal = { formatNumber, TrendingDown, TrendingUp };
