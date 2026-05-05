/**
 * LegalCounselDashboard (S4) — M_parity polish.
 *
 * Mode: REGENERATE → POLISHED. Visual structure adapted from Lovable's
 * 1236L LegalCounselDashboard.tsx. Critical-impact hero card + severity
 * donut surface the most important regulatory information first; impact
 * + update lists keep their colored severity pills.
 *
 *   GET /api/v1/dashboards/legal-counsel?windowDays=N
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  PieChart as PieIcon,
  ScrollText,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useLegalCounselDashboard } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  KpiTile,
  PlaceholderKpiTile,
  TimeRangeSelector,
  asWindowQuery,
  formatNumber,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import type {
  DashboardOpenImpactRow,
  DashboardRangeKey,
  DashboardRegulatoryUpdateRow,
} from "@/types/entities/dashboards.types";
import { formatDate } from "@/utils/datetime";

const DEFAULT_WINDOW_DAYS = 30;

const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-terracotta-tint text-terracotta-ink",
  high: "bg-amber-tint text-amber-ink",
  medium: "bg-amber-tint/60 text-amber-ink",
  low: "bg-sage-tint text-sage-ink",
  unknown: "bg-muted text-ink-muted",
};

const SEVERITY_FILL: Record<string, string> = {
  critical: "#C4634D",
  high: "#C68A3A",
  medium: "#D9B26A",
  low: "#86A89B",
  unknown: "#5A6B7C",
};

function severityClass(severity: string): string {
  return SEVERITY_TONE[severity.toLowerCase()] ?? SEVERITY_TONE.unknown;
}

export function LegalCounselDashboard() {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

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

  const severityMix = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const r of data?.lists.openImpacts5 ?? []) {
      const k = r.severity?.toLowerCase() ?? "unknown";
      buckets[k] = (buckets[k] ?? 0) + 1;
    }
    return Object.entries(buckets).map(([key, count]) => ({
      key,
      count,
      fill: SEVERITY_FILL[key] ?? SEVERITY_FILL.unknown,
    }));
  }, [data]);
  const severityMixTotal = severityMix.reduce((s, d) => s + d.count, 0);

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
            {t("dashboards.legalCounsel.title")}
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
          {/* Critical-impact hero */}
          {topCriticalImpact && (
            <Link
              to="/app/contracts/$id"
              params={{ id: String(topCriticalImpact.contractId) }}
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
                      {t("dashboards.common.detected")}:{" "}
                      {formatDate(topCriticalImpact.detectedAt)}
                    </span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-sm font-medium text-card">
                    {t("dashboards.legalCounsel.hero.openCta", {
                      defaultValue: "Open contract",
                    })}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </div>
                </div>
                <AlertTriangle className="h-12 w-12 text-terracotta" />
              </div>
            </Link>
          )}

          <section
            aria-label={t("dashboards.legalCounsel.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <KpiTile
              label={t("dashboards.legalCounsel.kpis.regulatoryUpdatesThisWindow")}
              value={formatNumber(data.kpis.regulatoryUpdatesThisWindow)}
            />
            <KpiTile
              label={t("dashboards.legalCounsel.kpis.openRegulatoryImpacts")}
              value={formatNumber(data.kpis.openRegulatoryImpacts)}
              variant={data.kpis.openRegulatoryImpacts > 0 ? "warning" : "default"}
            />
            <KpiTile
              label={t("dashboards.legalCounsel.kpis.criticalSeverityCount")}
              value={formatNumber(data.kpis.criticalSeverityCount)}
              variant={data.kpis.criticalSeverityCount > 0 ? "risk" : "default"}
            />
            <KpiTile
              label={t("dashboards.legalCounsel.kpis.regulationCatalogSize")}
              value={formatNumber(data.kpis.regulationCatalogSize)}
            />
            <PlaceholderKpiTile
              label={t("dashboards.legalCounsel.kpis.templateUsageThisWindow")}
              hint={t("dashboards.legalCounsel.kpis.templateUsageHint")}
            />
            <KpiTile
              label={t("dashboards.legalCounsel.kpis.auditEventsLabel")}
              value={
                data.kpis.auditSummary
                  ? formatNumber(
                      Object.values(data.kpis.auditSummary).reduce(
                        (sum, v) => sum + v,
                        0,
                      ),
                    )
                  : "—"
              }
              helper={
                data.kpis.auditSummary == null
                  ? t("dashboards.legalCounsel.kpis.auditSummaryDenied")
                  : undefined
              }
              disabled={data.kpis.auditSummary == null}
            />
          </section>

          {/* Severity donut + audit table */}
          <div className="grid gap-3 lg:grid-cols-3">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.legalCounsel.severityMix.title", {
                    defaultValue: "Open impacts by severity",
                  })}
                </h3>
              </div>
              {severityMixTotal === 0 ? (
                <DashboardEmptyState />
              ) : (
                <>
                  <div className="relative h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityMix}
                          dataKey="count"
                          nameKey="key"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                          stroke="var(--card)"
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {severityMix.map((d, i) => (
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
                      <span className="font-mono text-xl font-semibold text-ink">
                        {severityMixTotal}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
                        {t("dashboards.common.total", { defaultValue: "Total" })}
                      </span>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {severityMix.map((d) => (
                      <li
                        key={d.key}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-2 text-ink">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ background: d.fill }}
                          />
                          {t(`dashboards.common.severity.${d.key}`, {
                            defaultValue: d.key,
                          })}
                        </span>
                        <span className="font-mono text-ink-muted">{d.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-ink">
                  {t("dashboards.legalCounsel.auditSummary.title")}
                </h3>
              </div>
              <p className="mb-3 text-xs text-ink-subtle">
                {t("dashboards.legalCounsel.auditSummary.description")}
              </p>
              {data.kpis.auditSummary &&
              Object.keys(data.kpis.auditSummary).length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(data.kpis.auditSummary).map(
                    ([tableName, count]) => (
                      <li
                        key={tableName}
                        className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
                      >
                        <span className="font-mono text-xs text-ink-subtle">
                          {tableName}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-ink">
                          {formatNumber(count)}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <DashboardEmptyState />
              )}
            </section>
          </div>

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
              {row.regulator.nameEn}
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
