/**
 * LegalCounselDashboard (S4).
 *
 * Mode: REGENERATE. Lovable's LegalCounselDashboard.tsx (1236L) was the
 * largest of the role dashboards and pre-dated v2.6 fn_dashboard_legal_counsel.
 *
 *   GET /api/v1/dashboards/legal-counsel?windowDays=N
 *
 * AC mapping:
 *   AC-S4-01..04 — KPI grid (regulatoryUpdatesThisWindow / openRegulatoryImpacts /
 *                  criticalSeverityCount / regulationCatalogSize).
 *   AC-S4-05 — templateUsageThisWindow placeholder (DASH-OI-A).
 *   AC-S4-06 — auditSummary table — keys are live audit_log.table_name
 *              (S2-22-FIX-4); NULL when caller lacks 'audit.read' (CRIT-4
 *              lock — NOT 'audit.read.all').
 *   AC-S4-07 — 403 when caller is not legal_counsel / admin / Super Admin.
 *
 * 13-checklist: T1/T2/T3/T4/T5/T6/T7/T11/T12.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useLegalCounselDashboard } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  DashboardSection,
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
            />
            <KpiTile
              label={t("dashboards.legalCounsel.kpis.criticalSeverityCount")}
              value={formatNumber(data.kpis.criticalSeverityCount)}
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

          {data.kpis.auditSummary && Object.keys(data.kpis.auditSummary).length > 0 && (
            <DashboardSection
              title={t("dashboards.legalCounsel.auditSummary.title")}
              description={t(
                "dashboards.legalCounsel.auditSummary.description",
              )}
            >
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(data.kpis.auditSummary).map(
                  ([tableName, count]) => (
                    <li
                      key={tableName}
                      className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
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
            </DashboardSection>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <DashboardSection
              title={t(
                "dashboards.legalCounsel.lists.recentRegulatoryUpdatesTitle",
              )}
              description={t(
                "dashboards.legalCounsel.lists.recentRegulatoryUpdatesDescription",
              )}
            >
              <RegulatoryUpdateRows
                rows={data.lists.recentRegulatoryUpdates5}
              />
            </DashboardSection>

            <DashboardSection
              title={t("dashboards.legalCounsel.lists.openImpactsTitle")}
              description={t(
                "dashboards.legalCounsel.lists.openImpactsDescription",
              )}
            >
              <OpenImpactRows rows={data.lists.openImpacts5} />
            </DashboardSection>
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
