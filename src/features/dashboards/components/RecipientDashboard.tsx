/**
 * RecipientDashboard (S5).
 *
 * Mode: REGENERATE. Lovable's RecipientDashboard.tsx (476L) was tightly
 * supabase-coupled.
 *
 *   GET /api/v1/dashboards/recipient?windowDays=N
 *
 * AC mapping:
 *   AC-S5-01..03 — KPI grid (myContractsCount / pendingMySignatureCount /
 *                  signedByMeWindow). DN-19 / DN-E semantic limitation:
 *                  signedByMeWindow uses signature_event.actor_user_id —
 *                  external-only invitation signers (no user account)
 *                  are NOT counted; internal recipients (UAE-PASS or
 *                  app-authenticated) ARE counted (S2-22-FIX-1).
 *   AC-S5-04 — myObligationsCount placeholder (DASH-OI-A).
 *   AC-S5-05..06 — myContracts5 + pendingSignatures5 lists.
 *   AC-S5-07 — 403 when caller is not recipient / admin / Super Admin.
 *
 * 13-checklist: T1/T2/T3/T4/T5/T6/T7/T11/T12.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useRecipientDashboard } from "../hooks/useDashboards";
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
  DashboardRangeKey,
  RecipientMyContractsRow,
  RecipientPendingSignatureRow,
} from "@/types/entities/dashboards.types";
import { formatDateTime } from "@/utils/datetime";

const DEFAULT_WINDOW_DAYS = 30;

export function RecipientDashboard() {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useRecipientDashboard(
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
            {t("dashboards.recipient.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.recipient.subtitle")}
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
          fallbackKey="dashboards.recipient.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          <section
            aria-label={t("dashboards.recipient.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t("dashboards.recipient.kpis.myContractsCount")}
              value={formatNumber(data.kpis.myContractsCount)}
            />
            <KpiTile
              label={t("dashboards.recipient.kpis.pendingMySignatureCount")}
              value={formatNumber(data.kpis.pendingMySignatureCount)}
            />
            <KpiTile
              label={t("dashboards.recipient.kpis.signedByMeWindow")}
              value={formatNumber(data.kpis.signedByMeWindow)}
              helper={t("dashboards.recipient.kpis.signedByMeWindowHelper")}
            />
            <PlaceholderKpiTile
              label={t("dashboards.recipient.kpis.myObligationsCount")}
              hint={t("dashboards.recipient.kpis.myObligationsHint")}
            />
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <DashboardSection
              title={t("dashboards.recipient.lists.myContractsTitle")}
              description={t(
                "dashboards.recipient.lists.myContractsDescription",
              )}
            >
              <MyContractsList rows={data.lists.myContracts5} />
            </DashboardSection>

            <DashboardSection
              title={t("dashboards.recipient.lists.pendingSignaturesTitle")}
              description={t(
                "dashboards.recipient.lists.pendingSignaturesDescription",
              )}
            >
              <PendingSignaturesList rows={data.lists.pendingSignatures5} />
            </DashboardSection>
          </div>
        </>
      )}
    </motion.div>
  );
}

function MyContractsList({ rows }: { rows: RecipientMyContractsRow[] }) {
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
                {t(`contractStatus.${row.status}`, {
                  defaultValue: row.status,
                })}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink">{row.titleEn}</p>
            <p className="text-[11px] text-ink-muted">
              {t("dashboards.recipient.lists.counterpartyPending")}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PendingSignaturesList({
  rows,
}: {
  rows: RecipientPendingSignatureRow[];
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <DashboardEmptyState description={t("dashboards.common.emptyList")} />;
  }
  return (
    <ul role="list" className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.invitationId} role="listitem" className="py-2">
          <Link
            to="/app/contracts/$id"
            params={{ id: String(row.contractId) }}
            className="block rounded-md px-2 py-1 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={t("dashboards.common.openContractAria", {
              number: row.contractNumber,
              title: row.contractNumber,
            })}
          >
            <span className="font-mono text-xs text-ink-subtle">
              {row.contractNumber}
            </span>
            <p className="mt-1 text-sm text-ink">
              {t("dashboards.recipient.lists.invitationSent")}:{" "}
              {formatDateTime(row.sentAt)}
            </p>
            {row.expiresAt && (
              <p className="text-[11px] text-amber-ink">
                {t("dashboards.recipient.lists.invitationExpires")}:{" "}
                {formatDateTime(row.expiresAt)}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default RecipientDashboard;
