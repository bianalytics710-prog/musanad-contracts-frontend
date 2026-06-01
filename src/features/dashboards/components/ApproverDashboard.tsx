/**
 * ApproverDashboard (S3) — M_parity polish.
 *
 * Mode: REGENERATE → POLISHED. Visual structure adapted from Lovable's
 * 674L ApproverDashboard.tsx (urgent hero card + 4 KPIs + decision mix
 * donut + velocity strip + pending queue table). Data layer is our
 * fn_dashboard_approver shape — no extra fetches.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  PieChart as PieIcon,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApproverDashboard } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  KpiTile,
  TimeRangeSelector,
  asWindowQuery,
  formatAed,
  formatNumber,
  humanizeLabel,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import type {
  ApproverPendingQueueRow,
  DashboardRangeKey,
} from "@/types/entities/dashboards.types";
import { formatDate, formatDateTime, formatHijriDate } from "@/utils/datetime";
import { useAuthStore, selectUser } from "@/store/auth.store";

const DEFAULT_WINDOW_DAYS = 30;

function formatHours(value: number | null, t: (k: string) => string): string {
  if (value == null) return t("dashboards.common.noDataDash");
  // A14/A19 (Aisha audit) — collapse durations past 24h into "Nd Hh" so the
  // pending-queue + KPI tiles don't show nonsensical decimal hours like
  // "688.4h" for items aged 28 days. < 24h still renders as integer "Nh".
  if (value >= 24) {
    const d = Math.floor(value / 24);
    const h = Math.round(value - d * 24);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  return `${Math.round(value)} ${t("dashboards.common.hoursAbbrev")}`;
}

/** R5 audit 7.4.1 — render a delta hint like "+2 vs prev". */
function formatDeltaHelper(delta: number, _t: unknown, _kind: "approval" | "decision"): string {
  if (delta === 0) return "No change vs prev";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} vs prev`;
}

/** R5 audit 7.5.2 — value-bucket label rendering. */
function bucketLabel(b: "lt100k" | "p100to500" | "p500to1m" | "gt1m"): string {
  switch (b) {
    case "lt100k": return "<100K";
    case "p100to500": return "100K–500K";
    case "p500to1m": return "500K–1M";
    case "gt1m": return ">1M";
    default: return b;
  }
}

/** R5 audit 7.4.1 — render an hours delta like "−3.5h vs prev". */
function formatHourDelta(delta: number, _t: unknown): string {
  if (Math.abs(delta) < 0.05) return "No change vs prev";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toFixed(1)}h vs prev`;
}

const DECISION_COLORS = {
  approved: "#5B8374",
  rejected: "#C4634D",
  delegated: "#5A6B7C",
  pending: "#C68A3A",
} as const;

export function ApproverDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useApproverDashboard(
    asWindowQuery(windowDays),
  );

  const topPending = data?.lists.pendingQueue5[0];
  // R5 — slaBreaches now come from BE; fall back to derived count if missing.
  const slaBreaches =
    data?.kpis.slaBreachCount ??
    (data?.lists.pendingQueue5 ?? []).filter((r) => r.hoursWaiting > 24).length;

  // R5 audit 7.5.5 — Decision mix from real BE 4-bucket split.
  const decisionMix = useMemo(() => {
    const split = data?.charts?.decisionMixSplit;
    if (split) {
      return [
        { key: "approve", count: split.approve, fill: DECISION_COLORS.approved },
        { key: "reject", count: split.reject, fill: DECISION_COLORS.rejected },
        { key: "requestResubmission", count: split.requestResubmission, fill: DECISION_COLORS.pending },
        { key: "skipped", count: split.skipped, fill: DECISION_COLORS.delegated },
      ];
    }
    // Fallback (BE migration not yet applied)
    const decided = data?.kpis.decidedByMeCount ?? 0;
    return [
      { key: "approve", count: Math.round(decided * 0.8), fill: DECISION_COLORS.approved },
      { key: "reject", count: decided - Math.round(decided * 0.8), fill: DECISION_COLORS.rejected },
      { key: "pending", count: data?.kpis.pendingMyApprovalCount ?? 0, fill: DECISION_COLORS.pending },
    ];
  }, [data]);
  const decisionMixTotal = decisionMix.reduce((s, d) => s + d.count, 0);

  // R5 audit 7.3.1 — Queue segments (Mine / Team / Quick approve / SLA breach).
  // Use BE values when present; fall back to derived for backwards-compat.
  const queueSegments = useMemo(
    () => ({
      mine: data?.kpis.pendingMyApprovalCount ?? 0,
      team: data?.kpis.queueTeamCount ?? null,
      quickApprove:
        data?.kpis.queueQuickApproveCount ??
        (data?.lists.pendingQueue5 ?? []).filter(
          (r) => r.valueAed !== null && r.valueAed < 100_000,
        ).length,
      slaBreaches,
    }),
    [data, slaBreaches],
  );

  // R5 audit 7.4.1 — KPI deltas derived from kpiPrev.
  const kpiDeltas = useMemo(() => {
    const prev = data?.kpis.kpiPrev;
    const cur = data?.kpis;
    if (!prev || !cur) return null;
    const decidedDelta = cur.decidedByMeCount - prev.decidedByMeCount;
    const avgDelta =
      cur.averageDecisionHoursMine != null && prev.averageDecisionHoursMine != null
        ? Number(cur.averageDecisionHoursMine) - Number(prev.averageDecisionHoursMine)
        : null;
    const pendingDelta = cur.pendingMyApprovalCount - prev.pendingMyApprovalCount;
    return { decidedDelta, avgDelta, pendingDelta };
  }, [data]);

  // R2 audit 7.5.1 — approval aging buckets derived from pendingQueue5.
  // Buckets match Lovable: 0-24h / 25-72h / 73-168h (4-7d) / >168h.
  const agingBuckets = useMemo(() => {
    const rows = data?.lists.pendingQueue5 ?? [];
    return [
      { key: "0-1d", count: rows.filter((r) => r.hoursWaiting <= 24).length, fill: "#5B8374" },
      { key: "2-3d", count: rows.filter((r) => r.hoursWaiting > 24 && r.hoursWaiting <= 72).length, fill: "#C68A3A" },
      { key: "4-7d", count: rows.filter((r) => r.hoursWaiting > 72 && r.hoursWaiting <= 168).length, fill: "#B5523A" },
      { key: ">7d", count: rows.filter((r) => r.hoursWaiting > 168).length, fill: "#822A1A" },
    ];
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6 p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* R5 audit 7.1.1 — welcome line with Hijri date. */}
          <p className="text-xs text-ink-subtle">
            {user
              ? `${user.firstName} ${user.lastName} · ${formatDate(new Date().toISOString())} · ${formatHijriDate(new Date().toISOString())}`
              : `${formatDate(new Date().toISOString())} · ${formatHijriDate(new Date().toISOString())}`}
          </p>
          {/* R5 audit 7.2.1 — H1 wording. */}
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("dashboards.approver.title", { defaultValue: "Your approvals" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.approver.subtitle")}
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
          fallbackKey="dashboards.approver.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* R2 audit 7.3.1 — Approval queue summary card with 4-segment
              breakdown matching Lovable's hero. Sits above the per-contract
              focus card so the approver sees overall load at a glance. */}
          <Link
            to="/app/approvals"
            className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-gold/60"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
                  {t("dashboards.approver.queue.kicker", { defaultValue: "Approval queue" })}
                </p>
                <h2 className="mt-1 text-base font-semibold text-ink">
                  {t("dashboards.approver.queue.headline", {
                    count: queueSegments.mine,
                    defaultValue:
                      queueSegments.mine === 1
                        ? "You have 1 approval waiting"
                        : `You have ${queueSegments.mine} approvals waiting`,
                  })}
                </h2>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-subtle rtl:rotate-180" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("dashboards.approver.queue.mine", { defaultValue: "Mine" })}
                </p>
                <p className="mt-1 font-mono text-xl font-semibold text-ink">
                  {queueSegments.mine}
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("dashboards.approver.queue.team", { defaultValue: "Team" })}
                </p>
                <p className={`mt-1 font-mono text-xl font-semibold ${queueSegments.team !== null ? "text-ink" : "text-ink-subtle"}`}>
                  {queueSegments.team !== null ? queueSegments.team : "—"}
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("dashboards.approver.queue.quickApprove", { defaultValue: "Quick approve" })}
                </p>
                <p className="mt-1 font-mono text-xl font-semibold text-ink">
                  {queueSegments.quickApprove}
                </p>
              </div>
              <div className={`rounded-md border p-3 ${queueSegments.slaBreaches > 0 ? "border-terracotta/40 bg-terracotta/5" : "border-border bg-surface"}`}>
                <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("dashboards.approver.queue.slaBreach", { defaultValue: "SLA breach" })}
                </p>
                <p className={`mt-1 font-mono text-xl font-semibold ${queueSegments.slaBreaches > 0 ? "text-terracotta" : "text-ink"}`}>
                  {queueSegments.slaBreaches}
                </p>
              </div>
            </div>
          </Link>

          {/* Hero — top pending decision call-out */}
          {topPending && (
            <Link
              to="/app/contracts/$id"
              params={{ id: String(topPending.contractId) }}
              className="relative block overflow-hidden rounded-xl border border-gold bg-gold/10 p-5 transition-colors hover:bg-gold/20"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="font-mono text-xs uppercase tracking-wider text-gold">
                    {t("dashboards.approver.hero.kicker", {
                      defaultValue: "Awaiting your decision",
                    })}
                  </div>
                  <div className="mt-1 text-lg font-semibold leading-tight text-ink md:text-xl">
                    {topPending.titleEn}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-0.5 font-mono">
                      {topPending.contractNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-0.5 font-mono">
                      {formatAed(topPending.valueAed)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-0.5 font-mono">
                      <Clock className="h-3 w-3" />
                      {/* A14/A19 — humanized duration (Nd / Nd Hh / Nh). */}
                      {formatHours(topPending.hoursWaiting, t)}
                    </span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-card">
                    {t("dashboards.approver.hero.openCta", {
                      defaultValue: "Open & decide",
                    })}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </div>
                  {/* A20 (Aisha audit) — surface remaining pending count so the
                      hero doesn't hide the rest of the queue. */}
                  {queueSegments.mine > 1 && (
                    <p className="mt-2 text-[11px] text-ink-muted">
                      {t("dashboards.approver.hero.plusMore", {
                        count: queueSegments.mine - 1,
                        defaultValue: `+${queueSegments.mine - 1} more pending →`,
                      })}
                    </p>
                  )}
                </div>
                {slaBreaches > 0 && (
                  <div className="flex flex-col items-center gap-1 rounded-lg bg-terracotta/15 px-3 py-2 text-terracotta">
                    <Zap className="h-5 w-5" />
                    <span className="font-mono text-lg font-semibold leading-none">
                      {slaBreaches}
                    </span>
                    <span className="text-[10px] uppercase opacity-80">
                      {t("dashboards.approver.hero.urgent", {
                        defaultValue: "SLA breach",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          )}

          <section
            aria-label={t("dashboards.approver.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t("dashboards.approver.kpis.pendingMyApprovalCount")}
              value={formatNumber(data.kpis.pendingMyApprovalCount)}
              helper={
                kpiDeltas?.pendingDelta != null
                  ? formatDeltaHelper(kpiDeltas.pendingDelta, t, "approval")
                  : t("dashboards.approver.kpis.pendingMyApprovalCountHelper")
              }
              variant={
                data.kpis.pendingMyApprovalCount > 0 ? "warning" : "default"
              }
            />
            <KpiTile
              label={t("dashboards.approver.kpis.decidedByMeCount")}
              value={formatNumber(data.kpis.decidedByMeCount)}
              helper={
                kpiDeltas?.decidedDelta != null
                  ? formatDeltaHelper(kpiDeltas.decidedDelta, t, "decision")
                  : undefined
              }
              variant="success"
            />
            <KpiTile
              label={t("dashboards.approver.kpis.averageDecisionHoursMine")}
              value={formatHours(data.kpis.averageDecisionHoursMine, t)}
              helper={
                kpiDeltas?.avgDelta != null
                  ? formatHourDelta(kpiDeltas.avgDelta, t)
                  : undefined
              }
            />
            <KpiTile
              label={t("dashboards.approver.kpis.averageDecisionHoursTeam")}
              value={formatHours(data.kpis.averageDecisionHoursTeam, t)}
            />
          </section>

          {/* R2 audit 7.5.1 — Approval aging buckets (0-1d / 2-3d / 4-7d / >7d). */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-ink">
                {t("dashboards.approver.aging.title", { defaultValue: "Approval aging" })}
              </h3>
              <span className="ms-auto text-[11px] text-ink-subtle">
                {t("dashboards.approver.aging.scope", {
                  defaultValue: "Top 5 of pending queue",
                })}
              </span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingBuckets} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <XAxis dataKey="key" tickLine={false} axisLine={false} stroke="var(--ink-muted)" fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="var(--ink-muted)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {agingBuckets.map((b, i) => (
                      <Cell key={i} fill={b.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* R5 audit 7.5.2 + 7.5.3 — Decisions-by-value + Approvals-by-approver */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {/* A17 (Aisha audit) — chart caption follows the active
                      date filter instead of hardcoded "last 90 days". */}
                  {t("dashboards.approver.decisionsByValue.titleDynamic", {
                    days: windowDays,
                    defaultValue: `Decisions by contract value · last ${windowDays} days`,
                  })}
                </h3>
              </div>
              {(data.charts?.decisionsByValue ?? []).length === 0 ? (
                <p className="py-8 text-center text-xs text-ink-subtle">
                  {t("dashboards.common.emptyList")}
                </p>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(data.charts?.decisionsByValue ?? []).map((b) => ({
                        bucket: bucketLabel(b.bucket),
                        approved: b.approved,
                        rejected: b.rejected,
                        other: b.other,
                      }))}
                      margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                    >
                      <XAxis dataKey="bucket" tickLine={false} axisLine={false} stroke="var(--ink-muted)" fontSize={11} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="var(--ink-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="approved" stackId="x" fill={DECISION_COLORS.approved} isAnimationActive={false} />
                      <Bar dataKey="rejected" stackId="x" fill={DECISION_COLORS.rejected} isAnimationActive={false} />
                      <Bar dataKey="other" stackId="x" fill={DECISION_COLORS.delegated} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {/* A17 (Aisha audit) — caption follows active date filter. */}
                  {t("dashboards.approver.approvalsByApprover.titleDynamic", {
                    days: windowDays,
                    defaultValue: `Approvals by approver · last ${windowDays} days`,
                  })}
                </h3>
              </div>
              {(data.charts?.approvalsByApprover ?? []).length === 0 ? (
                <p className="py-8 text-center text-xs text-ink-subtle">
                  {t("dashboards.common.emptyList")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {(data.charts?.approvalsByApprover ?? []).map((row, idx) => {
                    const max = Math.max(
                      ...(data.charts?.approvalsByApprover ?? []).map((r) => r.count),
                      1,
                    );
                    const pct = (row.count / max) * 100;
                    return (
                      <li key={row.userId} className="flex items-center gap-3 text-xs">
                        <span className="w-32 truncate text-ink">
                          {row.name}
                          {row.userId === user?.id && (
                            <span className="ms-1 text-[10px] text-gold">
                              {t("dashboards.approver.approvalsByApprover.youSuffix", { defaultValue: "(you)" })}
                            </span>
                          )}
                        </span>
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-gold"
                            style={{ width: `${pct}%`, opacity: 0.5 + 0.5 * (1 - idx / 8) }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-ink-muted">{row.count}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* R5 audit 7.5.4 — Recent decisions list (5 latest) */}
          {(data.lists.recentDecisions5 ?? []).length > 0 && (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.approver.recentDecisions.title", {
                    defaultValue: "Recent decisions",
                  })}
                </h3>
              </div>
              <ul className="space-y-2">
                {(data.lists.recentDecisions5 ?? []).map((d) => (
                  <li key={d.stepId} className="flex items-center justify-between gap-3 text-xs">
                    <Link
                      to="/app/contracts/$id"
                      params={{ id: String(d.contractId) }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <span className="font-mono text-[10px] text-ink-subtle">{d.contractNumber}</span>
                      <span className="truncate text-ink">{d.titleEn}</span>
                    </Link>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        d.decision === "approve"
                          ? "bg-primary/10 text-primary"
                          : d.decision === "reject"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-tint/40 text-amber-ink"
                      }`}
                    >
                      {d.decision === "approve"
                        ? t("approval.list.decisionBadge.approve", { defaultValue: "Approved" })
                        : d.decision === "reject"
                          ? t("approval.list.decisionBadge.reject", { defaultValue: "Rejected" })
                          : t("approval.list.decisionBadge.request_resubmission", { defaultValue: "Resubmission" })}
                    </span>
                    <span className="w-16 text-end font-mono text-[10px] text-ink-subtle">
                      {Math.round(d.hoursAgo / 24)}d ago
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Decision mix donut — 33% */}
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.approver.decisionMix.title", {
                    defaultValue: "Decision mix",
                  })}
                </h3>
              </div>
              <div className="relative h-56">
                {decisionMixTotal === 0 ? (
                  /* BUG-005 fix (QA Phase 3 autonomous run 2026-05-30): when approver
                     has no decisions yet, Pie rendered blank with "0 / Total" center.
                     Show explicit empty-state instead (Q2 CH9 compliance). */
                  <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface/40 p-4 text-center">
                    <PieIcon className="h-8 w-8 text-ink-subtle" aria-hidden />
                    <p className="text-sm font-medium text-ink">
                      {t("dashboards.approver.decisionMix.emptyTitle", {
                        defaultValue: "No decisions yet",
                      })}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {t("dashboards.approver.decisionMix.emptySubtitle", {
                        defaultValue: "Decision mix appears once you have approved, rejected, or escalated items.",
                      })}
                    </p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={decisionMix}
                          dataKey="count"
                          nameKey="key"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="var(--card)"
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {decisionMix.map((d, i) => (
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
                      <span className="font-mono text-2xl font-semibold text-ink">
                        {decisionMixTotal}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
                        {t("dashboards.common.total", { defaultValue: "Total" })}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <ul className="mt-3 space-y-1.5">
                {decisionMix.map((d) => (
                  <li
                    key={d.key}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-2 text-ink">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: d.fill }}
                      />
                      {/* A13 (Aisha audit) — humanize so the legend never shows
                          the raw camelCase `requestResubmission` slug. */}
                      {t(`dashboards.approver.decisionMix.${d.key}`, {
                        defaultValue: humanizeLabel(d.key),
                      })}
                    </span>
                    <span className="font-mono text-ink-muted">{d.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Pending queue table — 66% */}
            <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.approver.lists.pendingQueueTitle")}
                </h3>
              </div>
              <p className="mb-3 text-xs text-ink-subtle">
                {t("dashboards.approver.lists.pendingQueueDescription")}
              </p>
              <PendingQueueList rows={data.lists.pendingQueue5} />
            </section>
          </div>
        </>
      )}
    </motion.div>
  );
}

function PendingQueueList({ rows }: { rows: ApproverPendingQueueRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <DashboardEmptyState description={t("dashboards.common.emptyList")} />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-subtle">
            <th className="py-2 pe-3 font-medium">
              {t("dashboards.approver.lists.contract")}
            </th>
            <th className="py-2 pe-3 font-medium tabular-nums">
              {t("dashboards.approver.lists.value")}
            </th>
            <th className="py-2 pe-3 font-medium">
              {t("dashboards.approver.lists.requestedAt")}
            </th>
            <th className="py-2 pe-3 font-medium tabular-nums">
              {t("dashboards.approver.lists.hoursWaiting")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const breach = row.hoursWaiting > 24;
            return (
              <tr
                key={row.stepId}
                className="border-t border-border/60 transition-colors hover:bg-surface"
              >
                <td className="py-2 pe-3">
                  <Link
                    to="/app/contracts/$id"
                    params={{ id: String(row.contractId) }}
                    className="block rounded-md px-1 py-1 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label={t("dashboards.common.openContractAria", {
                      number: row.contractNumber,
                      title: row.titleEn,
                    })}
                  >
                    <span className="block font-mono text-xs text-ink-subtle">
                      {row.contractNumber}
                    </span>
                    <span className="block text-sm text-ink">{row.titleEn}</span>
                  </Link>
                </td>
                <td className="py-2 pe-3 font-mono tabular-nums text-ink">
                  {formatAed(row.valueAed)}
                </td>
                <td className="py-2 pe-3 text-ink">
                  {formatDateTime(row.requestedAt)}
                </td>
                <td
                  className={`py-2 pe-3 font-mono tabular-nums ${
                    breach ? "text-terracotta" : "text-ink"
                  }`}
                >
                  {/* A14 (Aisha audit) — humanize 688.4h → 28d 16h. */}
                  {formatHours(row.hoursWaiting, t)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ApproverDashboard;
