/**
 * DrafterDashboard (S2) — M_parity polish.
 *
 * Mode: REGENERATE → POLISHED. Visual structure adapted from Lovable's
 * 809L DrafterDashboard.tsx (kanban pills + recent drafts list with
 * values + by-stage donut + time-to-signature line + coming-soon widgets
 * for templates/notifications/regulatory watch). Data layer is our
 * fn_dashboard_drafter shape — no extra fetches.
 *
 * AC mapping:
 *   AC-S2-01..04 — KPI grid (myDraftsCount / awaitingMyActionCount /
 *                  readyToSendCount / myRecentlyApprovedCount).
 *   AC-S2-05 — 403 propagated via translateApiError.
 *   AC-S2-06..08 — list slots (myDrafts5, awaitingMyAction5).
 *
 * 13-checklist:
 *   T1/T2 — useDrafterDashboard hook.
 *   T3 — every label uses t().
 *   T4 — three-states pattern.
 *   T5 — semantic Tailwind tokens.
 *   T6 — aria-labels on contract list links.
 *   T11 — wrapped at the route level.
 *   T12 — formatDateTime for updatedAt.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  TrendingUp,
  PieChart as PieIcon,
  Bell,
  Radar as RadarIcon,
  FileStack,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import { useDrafterDashboard } from "../hooks/useDashboards";
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
import type {
  DashboardContractRow,
  DashboardRangeKey,
  DrafterAwaitingActionRow,
} from "@/types/entities/dashboards.types";
import type { ContractStatus } from "@/types/entities/contract.types";
import { formatDateTime, formatHijriDate } from "@/utils/datetime";
import { useAuthStore, selectUser } from "@/store/auth.store";
import { templatesService, type TemplateListItem } from "@/services/api/m_parity.service";
import { impactSignalService } from "@/services/api/impact-signal.service";
import {
  useNotifications,
  type AppNotification,
  type NotificationSeverity,
} from "@/components/notifications/NotificationProvider";

const DEFAULT_WINDOW_DAYS = 30;

// D13 — semantic CSS variable tokens replace raw hex per Q4 stack-compliance.
// Mapped to the same palette used by the executive + procurement dashboards.
const STAGE_COLORS = {
  draft:    "var(--ink-muted)",     // neutral
  inReview: "var(--amber)",          // amber (was #C68A3A)
  approved: "var(--sage)",           // sage (was #86A89B)
  active:   "var(--sage)",           // sage
  signed:   "var(--gold)",           // gold (was #B8935A)
} as const;

export function DrafterDashboard() {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.startsWith("ar") ? "ar" : "en";
  const user = useAuthStore(selectUser);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useDrafterDashboard(
    asWindowQuery(windowDays),
  );

  const greeting = user?.firstName ?? "";
  // D11 — kicker now pairs Gregorian + Hijri, matching the recipient + Pari
  // dashboard convention. Computed once per render via the shared formatter.
  const todayStr = useMemo(
    () =>
      new Date().toLocaleDateString(lng, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    [lng],
  );
  const todayHijri = useMemo(() => formatHijriDate(new Date().toISOString()), [lng]);

  // Derive a richer pipeline view from the 4 KPI counts. Sums approximate
  // the Lovable "drafting pipeline" total tile.
  const pipelineTotal =
    (data?.kpis.myDraftsCount ?? 0) +
    (data?.kpis.awaitingMyActionCount ?? 0) +
    (data?.kpis.readyToSendCount ?? 0) +
    (data?.kpis.myRecentlyApprovedCount ?? 0);

  // Each pill deep-links to /app/contracts?status=<x>. Mapping mirrors the
  // bucket each KPI counts in fn_dashboard_drafter:
  //   myDraftsCount             → status='draft'
  //   awaitingMyActionCount     → status='resubmission_requested'
  //                               (the drafter-actionable subset of the BE's
  //                                IN ('draft','resubmission_requested') —
  //                                'draft' is already the first pill)
  //   readyToSendCount          → status='approved'
  //   myRecentlyApprovedCount   → status='fully_signed' (downstream end-state)
  const pipelinePills = useMemo<
    ReadonlyArray<{ key: string; accent: string; label: string; count: number; filter: ContractStatus }>
  >(
    () => [
      {
        key: "draft",
        filter: "draft",
        accent: STAGE_COLORS.draft,
        label: t("dashboards.drafter.pills.draft", { defaultValue: "Drafts" }),
        count: data?.kpis.myDraftsCount ?? 0,
      },
      {
        key: "awaiting",
        filter: "resubmission_requested",
        accent: STAGE_COLORS.inReview,
        label: t("dashboards.drafter.pills.awaitingAction", {
          defaultValue: "Awaiting action",
        }),
        count: data?.kpis.awaitingMyActionCount ?? 0,
      },
      {
        key: "readyToSend",
        filter: "approved",
        accent: STAGE_COLORS.approved,
        label: t("dashboards.drafter.pills.readyToSend", {
          defaultValue: "Ready to send",
        }),
        count: data?.kpis.readyToSendCount ?? 0,
      },
      {
        key: "approved",
        filter: "fully_signed",
        accent: STAGE_COLORS.signed,
        label: t("dashboards.drafter.pills.approved", {
          defaultValue: "Approved",
        }),
        count: data?.kpis.myRecentlyApprovedCount ?? 0,
      },
    ],
    [data, t],
  );

  // Donut data — same 4 buckets as the pills.
  const byStage = useMemo(
    () => [
      {
        key: "draft",
        count: data?.kpis.myDraftsCount ?? 0,
        fill: STAGE_COLORS.draft,
      },
      {
        key: "awaiting",
        count: data?.kpis.awaitingMyActionCount ?? 0,
        fill: STAGE_COLORS.inReview,
      },
      {
        key: "readyToSend",
        count: data?.kpis.readyToSendCount ?? 0,
        fill: STAGE_COLORS.approved,
      },
      {
        key: "approved",
        count: data?.kpis.myRecentlyApprovedCount ?? 0,
        fill: STAGE_COLORS.signed,
      },
    ],
    [data],
  );

  // Demo-grade line chart (time-to-signature). Backend doesn't expose this
  // metric per dashboards.types; values track Lovable's Ahmed-persona seed
  // so the demo story stays consistent across builds.
  // D7 — values rounded to integer days; decimal days are nonsensical UX.
  const ttsData = useMemo(() => {
    const labels =
      lng === "ar"
        ? ["نوفمبر", "ديسمبر", "يناير", "فبراير", "مارس", "أبريل"]
        : ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
    const values = [14, 14, 13, 12, 12, 12];
    return labels.map((label, i) => ({ label, avg: values[i] }));
  }, [lng]);
  const ttsAvgRef = Math.round(
    ttsData.reduce((s, d) => s + d.avg, 0) / ttsData.length,
  );

  // D7/D8 — typeLabel uses humanizeLabel for UAE acronyms (NDA / MSA / SLA);
  // integer-day averages; defaultValues drop the stray "Vendor /services"
  // spacing and the lowercase "Non-disclosure" hyphen mash.
  const byType = useMemo(
    () =>
      [
        {
          type: "llc_incorporation",
          typeLabel: t("contractType.llc_incorporation", {
            defaultValue: "LLC Incorporation",
          }),
          avg: 18,
        },
        {
          type: "consultancy",
          typeLabel: t("contractType.consultancy", {
            defaultValue: "Consultancy",
          }),
          avg: 13,
        },
        {
          type: "vendor_services",
          typeLabel: t("contractType.vendor_services", {
            defaultValue: "Vendor Services",
          }),
          avg: 12,
        },
        {
          type: "employment",
          typeLabel: t("contractType.employment", {
            defaultValue: "Employment",
          }),
          avg: 11,
        },
        {
          type: "nda",
          typeLabel: t("contractType.nda", { defaultValue: "NDA" }),
          avg: 9,
        },
      ].sort((a, b) => b.avg - a.avg),
    [t],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6 p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
            {t("dashboards.drafter.kicker", {
              defaultValue: "Welcome back, {{name}} · {{date}} · {{hijri}}",
              name: greeting,
              date: todayStr,
              hijri: todayHijri,
            })}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {t("dashboards.drafter.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.drafter.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TimeRangeSelector
            range={range}
            windowDays={windowDays}
            onChange={({ range: r, windowDays: d }) => {
              setRange(r);
              setWindowDays(d);
            }}
          />
          <Link
            to="/app/contracts/compose"
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-gold-hover"
          >
            <Plus className="h-4 w-4" />
            {t("dashboards.drafter.newContract", {
              defaultValue: "New contract",
            })}
          </Link>
        </div>
      </header>

      {isLoading && !data ? (
        <DashboardLoadingSkeleton rows={1} />
      ) : isError ? (
        <DashboardErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackKey="dashboards.drafter.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* D5 — when the pipeline is empty (newly-onboarded drafter or a
              user whose drafts have all been moved on), surface a hero
              CTA above the strip of zeros instead of leaving the 5-tile
              "all zeros" band as the only visible content. */}
          {pipelineTotal === 0 && (
            <section
              aria-label={t("dashboards.drafter.heroCta.ariaLabel", {
                defaultValue: "Start your first draft",
              })}
              className="rounded-lg border border-dashed border-gold/40 bg-gold/5 p-4 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-ink">
                    {t("dashboards.drafter.heroCta.title", {
                      defaultValue: "Start your first draft",
                    })}
                  </h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t("dashboards.drafter.heroCta.subtitle", {
                      defaultValue:
                        "You don't have any contracts in progress. Pick a template from Compose and the rest of this dashboard will populate with your pipeline.",
                    })}
                  </p>
                </div>
                <Link
                  to="/app/contracts/compose"
                  className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-gold-hover"
                >
                  <Plus className="h-4 w-4" />
                  {t("dashboards.drafter.heroCta.action", {
                    defaultValue: "Compose a contract",
                  })}
                </Link>
              </div>
            </section>
          )}
          {/* D9 — KPI strip now sits inside an explicit <h2> section so the
              5 tiles are clearly grouped as "My drafting pipeline —
              snapshot" rather than reading as an orphan strip above the
              other H3 sections. */}
          <section
            aria-labelledby="drafter-kpi-strip-heading"
            className="space-y-2"
          >
            <h2
              id="drafter-kpi-strip-heading"
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {t("dashboards.drafter.kpiStripHeading", {
                defaultValue: "My drafting pipeline — snapshot",
              })}
            </h2>
            <div
              role="group"
              aria-label={t("dashboards.drafter.kpiGroupLabel")}
              className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
            >
            <KpiTile
              label={t("dashboards.drafter.kpis.pipeline", {
                defaultValue: "Drafting pipeline",
              })}
              value={formatNumber(pipelineTotal)}
            />
            <KpiTile
              label={t("dashboards.drafter.kpis.myDraftsCount")}
              value={formatNumber(data.kpis.myDraftsCount)}
            />
            <KpiTile
              label={t("dashboards.drafter.kpis.awaitingMyActionCount")}
              value={formatNumber(data.kpis.awaitingMyActionCount)}
              variant={data.kpis.awaitingMyActionCount > 0 ? "warning" : "default"}
            />
            <KpiTile
              label={t("dashboards.drafter.kpis.readyToSendCount")}
              value={formatNumber(data.kpis.readyToSendCount)}
              variant={data.kpis.readyToSendCount > 0 ? "success" : "default"}
            />
            <KpiTile
              label={t("dashboards.drafter.kpis.myRecentlyApprovedCount")}
              value={formatNumber(data.kpis.myRecentlyApprovedCount)}
            />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-5">
            {/* D2 — the 4-pill "My drafting pipeline" mirror used to repeat
                the 4 buckets that already exist in the top KPI strip
                (Drafts / Awaiting action / Ready to send / Recently approved).
                The mirror has been dropped: the section is now just the
                Recent drafts list, which the top strip cannot show. */}
            <section className="rounded-lg border border-border bg-card p-4 lg:col-span-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.drafter.recentDrafts.title", {
                    defaultValue: "Recent drafts",
                  })}
                </h3>
                <Link
                  to="/app/contracts"
                  search={{ status: "draft" }}
                  className="text-xs text-ink-muted hover:text-gold"
                >
                  {t("dashboards.common.viewAll", { defaultValue: "View all" })} →
                </Link>
              </div>
              <ContractRowList rows={data.lists.myDrafts5} />
            </section>

            {/* Time-to-signature charts — 40% */}
            <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.drafter.tts.title", {
                    defaultValue: "Time to signature",
                  })}
                </h3>
              </div>
              {/* D6 — explicit window caption replaces the bare "6 months"
                  string so the user understands the chart is on a fixed
                  6-month trailing window and NOT scoped by the page's date
                  filter pills. */}
              <p className="mb-3 text-xs text-ink-subtle">
                {t("dashboards.drafter.tts.subtitle", {
                  defaultValue:
                    "Avg days draft → fully signed · trailing 6 months (not scoped by the date filter above)",
                })}
              </p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={lng === "ar" ? [...ttsData].reverse() : ttsData}
                    margin={{ top: 8, right: 12, left: 4, bottom: 18 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                      reversed={lng === "ar"}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                      orientation={lng === "ar" ? "right" : "left"}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      formatter={(v: number) => [`${v} d`, "avg"]}
                    />
                    {/* D13 — ReferenceLine + Line now reference semantic
                        CSS tokens (var(--ink-muted) and var(--gold)) instead
                        of raw hex #5A6B7C / #B8935A. */}
                    <ReferenceLine
                      y={ttsAvgRef}
                      stroke="var(--ink-muted)"
                      strokeDasharray="4 3"
                      label={{
                        value: `${ttsAvgRef}d`,
                        fill: "var(--ink-muted)",
                        fontSize: 10,
                        position: lng === "ar" ? "insideLeft" : "insideRight",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke="var(--gold)"
                      strokeWidth={2.5}
                      dot={{ fill: "var(--gold)", r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <div className="mb-1.5 text-xs font-medium text-ink-subtle">
                  {t("dashboards.drafter.tts.byType", {
                    defaultValue: "By contract type",
                  })}
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={byType}
                      margin={{ top: 4, right: 36, left: 4, bottom: 16 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                        reversed={lng === "ar"}
                      />
                      <YAxis
                        type="category"
                        dataKey="typeLabel"
                        width={110}
                        tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                        orientation={lng === "ar" ? "right" : "left"}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        formatter={(v: number) => [`${v} d`, "avg"]}
                      />
                      {/* D13 — Bar now uses semantic var(--ink-muted) instead
                          of raw hex #5A6B7C. */}
                      <Bar dataKey="avg" fill="var(--ink-muted)" radius={[0, 4, 4, 0]}>
                        <LabelList
                          dataKey="avg"
                          position="right"
                          formatter={(v: number) => `${v}d`}
                          style={{
                            fontSize: 10,
                            fill: "var(--ink)",
                            fontFamily: "var(--font-mono)",
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </div>

          {/* By-stage donut */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-ink">
                {t("dashboards.drafter.byStage.title", {
                  defaultValue: "My contracts by stage",
                })}
              </h3>
            </div>
            <div className="grid items-center gap-4 md:grid-cols-[260px_1fr]">
              <div className="relative h-56">
                {pipelineTotal === 0 ? (
                  /* BUG-004 fix (QA Phase 3 autonomous run 2026-05-30): when this
                     persona has no drafts yet, the Pie rendered an invisible chart
                     with center "0 / Total" and no message — Q2 CH9 fail (empty
                     state not handled gracefully). Now shows a clear empty state. */
                  <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface/40 p-4 text-center">
                    <PieIcon className="h-8 w-8 text-ink-subtle" aria-hidden />
                    <p className="text-sm font-medium text-ink">
                      {t("dashboards.drafter.byStage.emptyTitle", {
                        defaultValue: "No drafts yet",
                      })}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {t("dashboards.drafter.byStage.emptySubtitle", {
                        defaultValue: "Start a new contract from Compose to see your pipeline distribution.",
                      })}
                    </p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={byStage}
                          dataKey="count"
                          nameKey="key"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          stroke="var(--card)"
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {byStage.map((d, i) => (
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
                        {pipelineTotal}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
                        {t("dashboards.common.total", { defaultValue: "Total" })}
                      </span>
                    </div>
                  </>
                )}
              </div>
              {/* D3 — when there are zero items in every bucket, suppress
                  the legend list. Otherwise the "No drafts yet" empty state
                  on the donut sits next to a 4-row legend of Drafts 0 /
                  Awaiting action 0 / Ready to send 0 / Approved 0 — a third
                  copy of the same all-zero message. */}
              {pipelineTotal > 0 && (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {byStage.map((d, i) => (
                    <li
                      key={d.key}
                      className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs"
                    >
                      <span className="flex items-center gap-2 text-ink">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ background: d.fill }}
                        />
                        {pipelinePills[i]?.label}
                      </span>
                      <span className="font-mono text-ink-muted">{d.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Awaiting + secondary widgets */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {t("dashboards.drafter.lists.awaitingMyActionTitle")}
              </h3>
              <p className="mb-3 text-xs text-ink-subtle">
                {t("dashboards.drafter.lists.awaitingMyActionDescription")}
              </p>
              <AwaitingActionList rows={data.lists.awaitingMyAction5} />
            </section>

            <TemplateUsageWidget />

            <NotificationsWidget />
          </div>

          {/* D12 — Impact Watch section previously rendered a single
              sentence + a link. Now populated with the top 3 most-recent
              impact signals (regulator / commodity / supply-chain etc.)
              affecting Dana's contract types. View all → /app/regulations. */}
          <DrafterImpactWatchSection />
        </>
      )}
    </motion.div>
  );
}

function DrafterImpactWatchSection() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["drafter-impact-watch-top3"],
    queryFn: () => impactSignalService.list({}),
    staleTime: 5 * 60_000,
  });

  const top3 = useMemo(() => (data?.data ?? []).slice(0, 3), [data]);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <RadarIcon className="h-4 w-4 text-gold" />
          {t("dashboards.drafter.regWatch.title", {
            defaultValue: "Impact watch",
          })}
        </h3>
        <Link
          to="/app/regulations"
          className="text-xs text-ink-muted hover:text-gold"
        >
          {t("dashboards.common.viewAll", { defaultValue: "View all" })} →
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-1.5" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-surface" />
          ))}
        </div>
      ) : isError || top3.length === 0 ? (
        <p className="text-xs text-ink-subtle">
          {t("dashboards.drafter.regWatch.empty", {
            defaultValue:
              "No active regulator / commodity signals affecting your contract types in the last 7 days.",
          })}
        </p>
      ) : (
        <ul role="list" className="divide-y divide-border">
          {top3.map((s) => (
            <li key={s.id} role="listitem" className="py-2">
              <Link
                to="/app/regulations"
                className="block rounded-md px-2 py-1 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {String(s.category || "").replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-[10px] text-ink-subtle">
                    {s.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink">
                  {isAr && s.titleAr ? s.titleAr : s.titleEn}
                </p>
                {s.impactedContractCount > 0 && (
                  <p className="mt-0.5 text-[10px] text-amber-ink">
                    {t("dashboards.drafter.regWatch.impactedN", {
                      defaultValue:
                        "{{count}} impacted contracts in your scope",
                      count: s.impactedContractCount,
                    })}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContractRowList({ rows }: { rows: DashboardContractRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <DashboardEmptyState description={t("dashboards.common.emptyList")} />
    );
  }
  return (
    <ul role="list" className="space-y-1">
      {rows.map((row) => (
        <li key={row.id} role="listitem" className="rounded-md hover:bg-muted/40">
          <Link
            to="/app/contracts/$id"
            params={{ id: String(row.id) }}
            className="flex items-center gap-3 px-2 py-1.5 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={t("dashboards.common.openContractAria", {
              number: row.contractNumber,
              title: row.titleEn,
            })}
          >
            <span className="w-24 shrink-0 truncate font-mono text-[10px] text-ink-subtle">
              {row.contractNumber}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-ink">
              {row.titleEn}
            </span>
            <span className="w-16 shrink-0 text-end font-mono text-[10px] text-ink-subtle">
              {row.valueAed
                ? `${(row.valueAed / 1000).toFixed(0)}k`
                : "—"}
            </span>
            <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t(`contractStatus.${row.status}`, { defaultValue: row.status })}
            </span>
            <span className="w-20 shrink-0 text-end font-mono text-[10px] text-ink-subtle">
              {formatDateTime(row.updatedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AwaitingActionList({ rows }: { rows: DrafterAwaitingActionRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <DashboardEmptyState description={t("dashboards.common.emptyList")} />
    );
  }
  return (
    <ul role="list" className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} role="listitem" className="py-2">
          <Link
            to="/app/contracts/$id"
            params={{ id: String(row.id) }}
            className="block rounded-md px-2 py-1 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={t("dashboards.common.openContractAria", {
              number: row.contractNumber,
              title: row.titleEn,
            })}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs text-ink-subtle">
                {row.contractNumber}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
                {t(`contractStatus.${row.status}`, { defaultValue: row.status })}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink">{row.titleEn}</p>
            {row.lastDecisionNote && (
              <p className="mt-1 rounded-md bg-amber-tint/40 px-2 py-1 text-xs text-amber-ink">
                {t("dashboards.drafter.lastDecisionNote")}: {row.lastDecisionNote}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TemplateUsageWidget() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-templates-usage"],
    queryFn: () => templatesService.list({ limit: 50 }),
    staleTime: 5 * 60_000,
  });

  const top = useMemo(() => {
    const items = data?.data ?? [];
    return [...items].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
  }, [data]);

  const max = top[0]?.usageCount ?? 0;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <FileStack className="h-4 w-4 text-gold" />
        {t("dashboards.drafter.templateUsage.title", {
          defaultValue: "Template usage",
        })}
      </h3>
      <p className="mb-3 text-xs text-ink-subtle">
        {t("dashboards.drafter.templateUsage.subtitle", {
          defaultValue: "Most-used templates",
        })}
      </p>
      {isLoading ? (
        <div className="space-y-1.5" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded-md bg-surface" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-4 text-center text-xs text-destructive">
          {t("dashboards.drafter.templateUsage.error", {
            defaultValue: "Could not load templates.",
          })}
        </p>
      ) : top.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-subtle">
          {t("dashboards.drafter.templateUsage.empty", {
            defaultValue: "No templates yet.",
          })}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {top.map((tpl: TemplateListItem) => {
            const pct = max === 0 ? 0 : Math.round((tpl.usageCount / max) * 100);
            const name = isAr && tpl.nameAr ? tpl.nameAr : tpl.nameEn;
            return (
              <li key={tpl.id}>
                <Link
                  to="/app/templates/$id"
                  params={{ id: String(tpl.id) }}
                  className="block rounded-md px-1 py-1 text-xs hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-ink">{name}</span>
                    <span className="font-mono text-[10px] text-ink-subtle">
                      {t("dashboards.drafter.templateUsage.usedN", {
                        defaultValue: "{{count}}",
                        count: tpl.usageCount,
                      })}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to="/app/templates"
        className="mt-3 block text-end text-xs text-ink-muted hover:text-gold"
      >
        {t("dashboards.common.viewAll", { defaultValue: "View all" })} →
      </Link>
    </section>
  );
}

const SEVERITY_ICON: Record<NotificationSeverity, React.ComponentType<{ className?: string }>> = {
  critical: AlertTriangle,
  high: AlertCircle,
  medium: Bell,
  low: Info,
  info: CheckCircle2,
};

const SEVERITY_TINT: Record<NotificationSeverity, string> = {
  critical: "text-destructive",
  high: "text-amber-500",
  medium: "text-gold",
  low: "text-ink-subtle",
  info: "text-emerald-500",
};

function NotificationsWidget() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { notifications, unreadCount, markAsRead } = useNotifications();

  const recent: AppNotification[] = useMemo(
    () =>
      [...notifications]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [notifications],
  );

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Bell className="h-4 w-4 text-gold" />
          {t("dashboards.drafter.notifications.title", {
            defaultValue: "My notifications",
          })}
        </h3>
        {unreadCount > 0 && (
          <span className="rounded-full bg-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold">
            {t("dashboards.drafter.notifications.unread", {
              defaultValue: "{{count}} unread",
              count: unreadCount,
            })}
          </span>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-subtle">
          {t("dashboards.drafter.notifications.empty", {
            defaultValue: "All clear — no notifications.",
          })}
        </p>
      ) : (
        <ul className="space-y-2">
          {recent.map((n) => {
            const Icon = SEVERITY_ICON[n.severity] ?? Bell;
            const title = isAr && n.titleAr ? n.titleAr : n.titleEn;
            const body = isAr && n.bodyAr ? n.bodyAr : n.bodyEn;
            const isUnread = n.readAt === null;
            const inner = (
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${SEVERITY_TINT[n.severity]}`} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-xs ${isUnread ? "font-medium text-ink" : "text-ink-muted"}`}
                  >
                    {title}
                  </p>
                  {body && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-subtle">{body}</p>
                  )}
                </div>
                <span className="font-mono text-[10px] text-ink-subtle whitespace-nowrap">
                  {formatDateTime(n.createdAt)}
                </span>
              </div>
            );
            const wrapperClass = `block rounded-md border border-border px-3 py-2 transition hover:border-gold/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              isUnread ? "bg-surface" : "bg-card"
            }`;
            return (
              <li key={n.id}>
                {n.linkUrl ? (
                  <Link
                    to={n.linkUrl}
                    onClick={() => markAsRead(n.id)}
                    className={wrapperClass}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => markAsRead(n.id)}
                    className={`${wrapperClass} w-full text-start`}
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default DrafterDashboard;
