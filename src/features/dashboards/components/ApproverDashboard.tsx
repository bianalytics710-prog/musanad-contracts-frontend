/**
 * ApproverDashboard (S3).
 *
 * Mode: REGENERATE. Lovable's ApproverDashboard.tsx (674L) was tightly
 * supabase-coupled and pre-dated v2.6 fn_dashboard_approver shape. We
 * rebuild around:
 *   GET /api/v1/dashboards/approver?windowDays=N
 *
 * AC mapping:
 *   AC-S3-01..04 — KPI grid (pendingMyApprovalCount / decidedByMeCount /
 *                  averageDecisionHoursMine / averageDecisionHoursTeam).
 *                  Per-S2-22-FIX-2a, "mine" uses the COALESCE(delegated_to,
 *                  reassigned_to, approver_user_id) override chain — the
 *                  FE just renders the BE-computed numbers.
 *   AC-S3-05 — pendingQueue5 list (joined approval_step + contract).
 *   AC-S3-06 — 403 when caller is not approver / admin / Super Admin.
 *
 * 13-checklist: T1/T2/T3/T4/T5/T6/T7/T11/T12.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useApproverDashboard } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  DashboardSection,
  KpiTile,
  TimeRangeSelector,
  asWindowQuery,
  formatAed,
  formatNumber,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import type {
  ApproverPendingQueueRow,
  DashboardRangeKey,
} from "@/types/entities/dashboards.types";
import { formatDateTime } from "@/utils/datetime";

const DEFAULT_WINDOW_DAYS = 30;

function formatHours(value: number | null, t: (k: string) => string): string {
  if (value == null) return t("dashboards.common.noDataDash");
  return `${value.toFixed(1)} ${t("dashboards.common.hoursAbbrev")}`;
}

export function ApproverDashboard() {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useApproverDashboard(
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
            {t("dashboards.approver.title")}
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
          <section
            aria-label={t("dashboards.approver.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t("dashboards.approver.kpis.pendingMyApprovalCount")}
              value={formatNumber(data.kpis.pendingMyApprovalCount)}
              helper={t(
                "dashboards.approver.kpis.pendingMyApprovalCountHelper",
              )}
            />
            <KpiTile
              label={t("dashboards.approver.kpis.decidedByMeCount")}
              value={formatNumber(data.kpis.decidedByMeCount)}
            />
            <KpiTile
              label={t("dashboards.approver.kpis.averageDecisionHoursMine")}
              value={formatHours(data.kpis.averageDecisionHoursMine, t)}
            />
            <KpiTile
              label={t("dashboards.approver.kpis.averageDecisionHoursTeam")}
              value={formatHours(data.kpis.averageDecisionHoursTeam, t)}
            />
          </section>

          <DashboardSection
            title={t("dashboards.approver.lists.pendingQueueTitle")}
            description={t("dashboards.approver.lists.pendingQueueDescription")}
          >
            <PendingQueueList rows={data.lists.pendingQueue5} />
          </DashboardSection>
        </>
      )}
    </motion.div>
  );
}

function PendingQueueList({ rows }: { rows: ApproverPendingQueueRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-ink-subtle">
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
          {rows.map((row) => (
            <tr key={row.stepId} className="border-t border-border/60">
              <td className="py-2 pe-3">
                <Link
                  to="/app/contracts/$id"
                  params={{ id: String(row.contractId) }}
                  className="block rounded-md px-1 py-1 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <td className="py-2 pe-3 tabular-nums text-ink">
                {formatAed(row.valueAed)}
              </td>
              <td className="py-2 pe-3 text-ink">
                {formatDateTime(row.requestedAt)}
              </td>
              <td className="py-2 pe-3 tabular-nums text-ink">
                {row.hoursWaiting.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ApproverDashboard;
