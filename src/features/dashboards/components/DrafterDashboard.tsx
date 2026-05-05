/**
 * DrafterDashboard (S2).
 *
 * Mode: REGENERATE. Lovable's DrafterDashboard.tsx (809L) was tightly
 * supabase-coupled and pre-dated v2.6 fn_dashboard_drafter shape. We
 * rebuild around:
 *   GET /api/v1/dashboards/drafter?windowDays=N
 *
 * AC mapping:
 *   AC-S2-01..04 — KPI grid (myDraftsCount / awaitingMyActionCount /
 *                  readyToSendCount / myRecentlyApprovedCount).
 *   AC-S2-05 — 403 propagated via translateApiError when caller is not
 *              drafter / admin / Super Admin.
 *   AC-S2-06..08 — list slots (myDrafts5, awaitingMyAction5).
 *
 * 13-checklist:
 *   T1/T2 — useDrafterDashboard hook.
 *   T3 — every label uses t().
 *   T4 — three-states pattern.
 *   T5 — semantic Tailwind tokens only.
 *   T6 — aria-labels on the contract list links; role=list / listitem.
 *   T11 — wrapped at the route level.
 *   T12 — formatDateTime for updatedAt.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useDrafterDashboard } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  DashboardSection,
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
import { formatDateTime } from "@/utils/datetime";

const DEFAULT_WINDOW_DAYS = 30;

export function DrafterDashboard() {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useDrafterDashboard(
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
            {t("dashboards.drafter.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.drafter.subtitle")}
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
          fallbackKey="dashboards.drafter.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          <section
            aria-label={t("dashboards.drafter.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t("dashboards.drafter.kpis.myDraftsCount")}
              value={formatNumber(data.kpis.myDraftsCount)}
            />
            <KpiTile
              label={t("dashboards.drafter.kpis.awaitingMyActionCount")}
              value={formatNumber(data.kpis.awaitingMyActionCount)}
            />
            <KpiTile
              label={t("dashboards.drafter.kpis.readyToSendCount")}
              value={formatNumber(data.kpis.readyToSendCount)}
            />
            <KpiTile
              label={t("dashboards.drafter.kpis.myRecentlyApprovedCount")}
              value={formatNumber(data.kpis.myRecentlyApprovedCount)}
            />
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <DashboardSection
              title={t("dashboards.drafter.lists.myDraftsTitle")}
              description={t("dashboards.drafter.lists.myDraftsDescription")}
            >
              <ContractRowList rows={data.lists.myDrafts5} />
            </DashboardSection>

            <DashboardSection
              title={t("dashboards.drafter.lists.awaitingMyActionTitle")}
              description={t(
                "dashboards.drafter.lists.awaitingMyActionDescription",
              )}
            >
              <AwaitingActionList rows={data.lists.awaitingMyAction5} />
            </DashboardSection>
          </div>
        </>
      )}
    </motion.div>
  );
}

function ContractRowList({ rows }: { rows: DashboardContractRow[] }) {
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
            <p className="text-[11px] text-ink-muted">
              {t("dashboards.common.updated", {
                when: formatDateTime(row.updatedAt),
              })}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AwaitingActionList({ rows }: { rows: DrafterAwaitingActionRow[] }) {
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

export default DrafterDashboard;
