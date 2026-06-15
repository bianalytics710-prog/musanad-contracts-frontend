/**
 * LegalCounselDashboard — revamp (mig 685).
 *
 * Replaces cross-role noise (risk-exposure donut, regulatory-updates chart,
 * obligations-at-risk, open-impacts) with LC-relevant modules:
 *   - Advisory & notices pipeline
 *   - Third-party review pipeline
 *   - Template & clause library
 *   - My risk cases
 *
 * KEPT from prior build:
 *   - My approval queue (from useLegalCounselDashboard)
 *   - Avg legal review time line chart (lifted into its own card)
 *   - Contract types donut (from useLegalCounselDashboard)
 *   - Activity feed with filter pills (from useLegalCounselDashboard)
 *
 * Data sources:
 *   useLegalCounselDashboard  → approvalQueue5, avgReview12w, contractTypes, activityFeed
 *   useLegalCounselInsights   → kpis, advisoryPipeline, tpaPipeline, templateClause, myRiskCases
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Briefcase,
  Clock,
  FileStack,
  FileText,
  PieChart as PieIcon,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
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
import { useLegalCounselDashboard, useLegalCounselInsights } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  KpiTile,
  asWindowQuery,
  formatNumber,
} from "./dashboard-primitives";
import { useAuthStore, selectUser } from "@/store/auth.store";
import { formatDate, formatHijriDate } from "@/utils/datetime";
import type {
  LegalCounselApprovalQueueRow,
  LegalCounselWeekHours,
  LegalCounselContractTypeRow,
  LegalCounselActivityRow,
  LegalCounselRiskCaseRow,
  LegalCounselTpaPipelineRow,
} from "@/types/entities/dashboards.types";

const DEFAULT_WINDOW_DAYS = 30;

// Activity feed filter pills
type ActivityFilter = "all" | "mine" | "high";

export function LegalCounselDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const {
    data,
    isLoading: mainLoading,
    isError: mainError,
    error: mainErr,
    refetch: mainRefetch,
  } = useLegalCounselDashboard(asWindowQuery(DEFAULT_WINDOW_DAYS));

  const {
    data: insights,
    isLoading: insightsLoading,
    isError: insightsError,
  } = useLegalCounselInsights();

  const isLoading = mainLoading || insightsLoading;
  const isError = mainError || insightsError;

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

  const filteredActivity = useMemo(() => {
    const all = data?.activityFeed ?? [];
    switch (activityFilter) {
      case "mine":
        return user ? all.filter((a) => a.actorUserId === user.id) : [];
      case "high":
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
          <p className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
            {user
              ? `${t("dashboards.common.welcome", { defaultValue: "Welcome back" })}, ${user.firstName} ${user.lastName} · ${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`
              : `${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {t("dashboards.legalCounsel.title", { defaultValue: "Legal insights" })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.legalCounsel.subtitle")}
          </p>
        </div>
      </header>

      {isLoading && !data && !insights ? (
        <DashboardLoadingSkeleton rows={1} />
      ) : isError ? (
        <DashboardErrorState
          error={mainErr}
          onRetry={() => void mainRefetch()}
          fallbackKey="dashboards.legalCounsel.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* ── KPI row ── */}
          <section
            aria-label={t("dashboards.legalCounsel.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Link to="/app/approvals" className="block">
              <KpiTile
                label={t("dashboards.legalCounsel.kpis.pendingMyReview", {
                  defaultValue: "Pending my review",
                })}
                value={formatNumber(insights?.kpis.contractsPendingMyReview ?? 0)}
                variant={
                  (insights?.kpis.contractsPendingMyReview ?? 0) > 0 ? "warning" : "default"
                }
              />
            </Link>
            <Link to="/app/work" className="block">
              <KpiTile
                label={t("dashboards.legalCounsel.kpis.advisoriesInProgress", {
                  defaultValue: "Advisories in progress",
                })}
                value={formatNumber(insights?.kpis.advisoriesInProgress ?? 0)}
              />
            </Link>
            <Link to="/app/legal/third-party-review" className="block">
              <KpiTile
                label={t("dashboards.legalCounsel.kpis.tpaAwaitingMe", {
                  defaultValue: "TPA awaiting me",
                })}
                value={formatNumber(insights?.kpis.tpaReviewsAwaitingMe ?? 0)}
                variant={
                  (insights?.kpis.tpaReviewsAwaitingMe ?? 0) > 0 ? "warning" : "default"
                }
              />
            </Link>
            <Link to="/app/risk-cases" className="block">
              <KpiTile
                label={t("dashboards.legalCounsel.kpis.myOpenRiskCases", {
                  defaultValue: "My open risk cases",
                })}
                value={formatNumber(insights?.kpis.myOpenRiskCases ?? 0)}
                variant={
                  (insights?.kpis.myOpenRiskCases ?? 0) > 0 ? "warning" : "default"
                }
              />
            </Link>
          </section>

          {/* ── Row 2: Approval queue (lg:col-span-2) + Advisory & notices ── */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* My approval queue */}
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

            {/* Advisory & notices pipeline */}
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.legalCounsel.advisory.title", {
                    defaultValue: "Advisory & notices",
                  })}
                </h3>
              </div>
              {insights ? (
                <div className="grid grid-cols-2 gap-3">
                  <AdvisoryStatCell
                    label={t("dashboards.legalCounsel.advisory.draft", {
                      defaultValue: "Draft",
                    })}
                    value={insights.advisoryPipeline.draft}
                  />
                  <AdvisoryStatCell
                    label={t("dashboards.legalCounsel.advisory.inExecReview", {
                      defaultValue: "In exec review",
                    })}
                    value={insights.advisoryPipeline.inExecReview}
                  />
                  <AdvisoryStatCell
                    label={t("dashboards.legalCounsel.advisory.approvedReady", {
                      defaultValue: "Approved — ready",
                    })}
                    value={insights.advisoryPipeline.approvedReady}
                  />
                  <AdvisoryStatCell
                    label={t("dashboards.legalCounsel.advisory.sentThisMonth", {
                      defaultValue: "Sent this month",
                    })}
                    value={insights.advisoryPipeline.sentThisMonth}
                    highlight
                  />
                </div>
              ) : (
                <DashboardEmptyState />
              )}
            </section>
          </div>

          {/* ── Row 3: TPA pipeline + Template/clause library + My risk cases ── */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Third-party review pipeline */}
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <TrendingUp className="h-4 w-4 text-gold" />
                  {t("dashboards.legalCounsel.tpa.title", {
                    defaultValue: "Third-party review pipeline",
                  })}
                </h3>
                <Link
                  to="/app/legal/third-party-review"
                  className="text-xs font-medium text-gold hover:underline"
                >
                  {t("dashboards.common.viewAll", { defaultValue: "View all →" })}
                </Link>
              </div>
              <TpaPipelineList rows={insights?.tpaPipeline ?? []} />
            </section>

            {/* Template & clause library */}
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileStack className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.legalCounsel.templateClause.title", {
                    defaultValue: "Template & clause library",
                  })}
                </h3>
              </div>
              {insights ? (
                <div className="space-y-3">
                  <LibraryStatRow
                    label={t("dashboards.legalCounsel.templateClause.templates", {
                      defaultValue: "Templates",
                    })}
                    value={insights.templateClause.templateCount}
                  />
                  <LibraryStatRow
                    label={t("dashboards.legalCounsel.templateClause.clauses", {
                      defaultValue: "Clauses",
                    })}
                    value={insights.templateClause.clauseCount}
                  />
                  <LibraryStatRow
                    label={t("dashboards.legalCounsel.templateClause.approvedClauses", {
                      defaultValue: "Approved clauses",
                    })}
                    value={insights.templateClause.approvedClauseCount}
                    highlight
                  />
                </div>
              ) : (
                <DashboardEmptyState />
              )}
            </section>

            {/* My risk cases */}
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <ShieldAlert className="h-4 w-4 text-gold" />
                  {t("dashboards.legalCounsel.riskCases.title", {
                    defaultValue: "My risk cases",
                  })}
                </h3>
                <Link
                  to="/app/risk-cases"
                  className="text-xs font-medium text-gold hover:underline"
                >
                  {t("dashboards.common.viewAll", { defaultValue: "View all →" })}
                </Link>
              </div>
              <MyRiskCasesList rows={insights?.myRiskCases ?? []} />
            </section>
          </div>

          {/* ── Row 4: Contract types donut + Avg review time ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Contract types donut */}
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
              <ContractTypesDonut
                rows={data.contractTypes.rows}
                total={data.contractTypes.total}
              />
            </section>

            {/* Avg legal review time (line chart, lifted from risk card) */}
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.legalCounsel.avgReview.title", {
                    defaultValue: "Avg legal review time",
                  })}
                </h3>
              </div>
              <p className="mb-3 text-xs text-ink-subtle">
                {t("dashboards.legalCounsel.avgReview.subtitle", {
                  defaultValue: "Hours per week · last 12 weeks",
                })}
              </p>
              <div className="mb-2 text-right font-mono text-sm text-ink">
                {t("dashboards.legalCounsel.avgReview.currentWeek", {
                  defaultValue: "Current week",
                })}
                :{" "}
                <span className="font-semibold">{Math.round(currentWeekReviewHours)}h</span>
              </div>
              <div className="h-40">
                <ReviewTimeChart data={reviewChartData} />
              </div>
            </section>
          </div>

          {/* ── Row 5: Activity feed (full width) ── */}
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
        </>
      )}
    </motion.div>
  );
}

// ── Shared contract-type humanizer ──────────────────────────────────────────

function humanizeContractType(slug: string | null | undefined): string {
  if (!slug) return "—";
  const map: Record<string, string> = {
    services: "Services",
    epc: "EPC",
    gas_spa: "Gas SPA",
    concession: "Concession",
    employment: "Employment",
    consultancy: "Consultancy",
    advisory: "Advisory",
    nda: "Non-disclosure",
    master_services: "Master Services",
    vendor_services: "Vendor Services",
    sow: "SOW",
    supply: "Supply",
  };
  return (
    map[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
  );
}

// ── ApprovalQueueTable ───────────────────────────────────────────────────────

function ApprovalQueueTable({ rows }: { rows: LegalCounselApprovalQueueRow[] }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
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
        <thead className="text-[10px] font-medium tracking-wider text-ink-subtle">
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
            const drafterName = [r.drafterFirstName, r.drafterLastName]
              .filter(Boolean)
              .join(" ");
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
                    <div
                      className="text-sm text-ink"
                      dir={isAr && (r as { titleAr?: string | null }).titleAr ? "rtl" : "ltr"}
                    >
                      {isAr && (r as { titleAr?: string | null }).titleAr
                        ? (r as { titleAr: string }).titleAr
                        : r.titleEn}
                    </div>
                  </Link>
                </td>
                <td className="py-2 text-xs text-ink-muted">
                  {t(`contractType.${r.contractType}`, {
                    defaultValue: humanizeContractType(r.contractType),
                  })}
                </td>
                <td className="py-2 text-xs text-ink-muted">
                  {drafterName || "—"}
                </td>
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

// ── AdvisoryStatCell ─────────────────────────────────────────────────────────

function AdvisoryStatCell({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-surface/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-subtle">{label}</p>
      <p
        className={`mt-1 font-mono text-xl font-semibold ${highlight ? "text-gold" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

// ── TpaPipelineList ──────────────────────────────────────────────────────────

function TpaPipelineList({ rows }: { rows: LegalCounselTpaPipelineRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <DashboardEmptyState
        description={t("dashboards.legalCounsel.tpa.empty", {
          defaultValue: "No third-party reviews",
        })}
      />
    );
  }
  const humanizeStatus = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  return (
    <ul role="list" className="divide-y divide-border/50">
      {rows.map((r) => (
        <li
          key={r.status}
          className="flex items-center justify-between gap-2 py-2 text-sm"
        >
          <span className="text-ink">{humanizeStatus(r.status)}</span>
          <span className="font-mono text-sm font-semibold text-ink">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

// ── LibraryStatRow ───────────────────────────────────────────────────────────

function LibraryStatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-ink">{label}</span>
      <span
        className={`font-mono text-sm font-semibold ${highlight ? "text-gold" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── MyRiskCasesList ──────────────────────────────────────────────────────────

const PRIORITY_CLASS: Record<string, string> = {
  critical: "bg-terracotta-tint text-terracotta-ink",
  high: "bg-amber-tint text-amber-ink",
  medium: "bg-amber-tint/60 text-amber-ink",
  low: "bg-sage-tint text-sage-ink",
};

function MyRiskCasesList({ rows }: { rows: LegalCounselRiskCaseRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-subtle">
        {t("dashboards.legalCounsel.riskCases.empty", {
          defaultValue: "No risk cases assigned to you",
        })}
      </p>
    );
  }
  const humanize = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  return (
    <ul role="list" className="divide-y divide-border/50">
      {rows.map((rc) => (
        <li key={rc.id} className="py-2">
          <Link
            to="/app/risk-cases/$caseId"
            params={{ caseId: String(rc.id) }}
            className="block rounded-md px-1 transition-colors hover:bg-surface/50"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-ink line-clamp-2">{rc.title}</p>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${PRIORITY_CLASS[rc.priority] ?? "bg-muted text-ink-muted"}`}
              >
                {humanize(rc.priority)}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-subtle">
              {humanize(rc.caseType)} · {humanize(rc.status)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── ContractTypesDonut ───────────────────────────────────────────────────────

function ContractTypesDonut({
  rows,
  total,
}: {
  rows: LegalCounselContractTypeRow[];
  total: number;
}) {
  const { t } = useTranslation();
  const palette = [
    "#C68A3A",
    "#86A89B",
    "#D9B26A",
    "#7A8FA6",
    "#A28BB7",
    "#9F7C39",
    "#5A6B7C",
    "#C4634D",
  ];
  const data = rows.map((r, i) => ({
    type: t(`contractType.${r.type}`, {
      defaultValue: humanizeContractType(r.type),
    }),
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

// ── ReviewTimeChart ──────────────────────────────────────────────────────────

function ReviewTimeChart({ data }: { data: Array<{ week: string; hours: number }> }) {
  if (data.length === 0) return <DashboardEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
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
          stroke="#D9B26A"
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── ActivityFeedList ─────────────────────────────────────────────────────────

function ActivityFeedList({ rows }: { rows: LegalCounselActivityRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }
  return (
    <ul role="list" className="space-y-2 text-sm">
      {rows.slice(0, 12).map((r) => (
        <li key={r.id} className="flex items-baseline gap-2">
          <span
            className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold/60"
            aria-hidden
          />
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

export default LegalCounselDashboard;
