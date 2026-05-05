/**
 * ExecutiveDashboard (S7) — also mounts ExecutiveAnomaliesCard (S9 closure).
 *
 * Mode: REGENERATE — Lovable's ExecutiveDashboard.tsx (1825L) was the
 * largest insights component, heavily supabase-coupled per DASH-OI-B
 * (supabase.functions.invoke direct calls, supabase.from() reads, multiple
 * non-existent tables). M5 precedent (1/20 harden ratio) confirms regenerate
 * is the right call. Default windowDays = 90 per AC-S7-02.
 *
 *   GET /api/v1/dashboards/executive?windowDays=N
 *
 * AC mapping:
 *   AC-S7-01..02 — KPI grid + window pills (default last_90d).
 *   AC-S7-03 — expiry cliffs monotonic (server-validated).
 *   AC-S7-04 — top counterparties by value (counterpartyId only —
 *              parties module pending; "pending" label rendered).
 *   AC-S7-05 — aiCostUsdWindow inline; null marker rendered when caller
 *              lacks ai.observability.read.
 *   AC-S7-06 — 403 when caller is not executive / admin / Super Admin.
 *   AC-S7-07 — windowDays validation 400 surfaced via translateApiError.
 *
 * S9 — MOUNTS the existing M4 ExecutiveAnomaliesCard. The card consumes
 * POST /api/v1/ai/executive-anomalies (M4) on demand; the parent dashboard
 * passes precomputed stats so the card can self-fire (autoFetch).
 *
 * 13-checklist: T1/T2/T3/T4/T5/T6/T7/T11/T12.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useExecutiveDashboard } from "../hooks/useDashboards";
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
  formatUsd,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import type {
  CounterpartyConcentrationRow,
  DashboardRangeKey,
  ExecutiveExpiryCliffs,
  TrendMonthCount,
  TrendMonthValueAed,
  ValueDistributionBucket,
} from "@/types/entities/dashboards.types";
import { ExecutiveAnomaliesCard } from "@/features/ai/components/ExecutiveAnomaliesCard";
import type {
  AiExecutiveAnomaliesStats,
  AiLanguage,
} from "@/types/entities/ai.types";

const DEFAULT_WINDOW_DAYS = 90;

export function ExecutiveDashboard() {
  const { t, i18n } = useTranslation();
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useExecutiveDashboard(
    asWindowQuery(windowDays),
  );

  // Stats payload for the M4 ExecutiveAnomaliesCard mount (S9). The
  // anomaly card auto-fires once stats arrive (autoFetch=true default).
  const anomaliesStats: AiExecutiveAnomaliesStats | null = useMemo(() => {
    if (!data) return null;
    return {
      totalActiveValueAed: data.kpis.totalActiveValueAed,
      contractsByStatus: data.kpis.contractsByStatus,
      expiryCliffs: [
        { window: "next30d", count: data.kpis.expiryCliffs.next30d },
        { window: "next60d", count: data.kpis.expiryCliffs.next60d },
        { window: "next90d", count: data.kpis.expiryCliffs.next90d },
      ],
      supplierConcentration: data.kpis.topCounterpartiesByValue5.map((c) => ({
        supplier: `counterparty-${c.counterpartyId}`,
        share:
          data.kpis.totalActiveValueAed > 0
            ? c.totalValueAed / data.kpis.totalActiveValueAed
            : 0,
      })),
    };
  }, [data]);

  const language: AiLanguage = i18n.language?.startsWith("ar") ? "ar" : "en";

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
            {t("dashboards.executive.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.executive.subtitle")}
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
        <DashboardLoadingSkeleton rows={2} />
      ) : isError ? (
        <DashboardErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackKey="dashboards.executive.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* Top-line KPIs */}
          <section
            aria-label={t("dashboards.executive.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t("dashboards.executive.kpis.totalActiveValueAed")}
              value={formatAed(data.kpis.totalActiveValueAed)}
            />
            <KpiTile
              label={t("dashboards.executive.kpis.openRegulatoryImpactsCritical")}
              value={formatNumber(data.kpis.openRegulatoryImpactsCritical)}
            />
            <KpiTile
              label={t("dashboards.executive.kpis.aiCostUsdWindow")}
              value={
                data.kpis.aiCostUsdWindow == null
                  ? "—"
                  : formatUsd(data.kpis.aiCostUsdWindow)
              }
              helper={
                data.kpis.aiCostUsdWindow == null
                  ? t("dashboards.executive.kpis.aiCostDenied")
                  : t("dashboards.executive.kpis.aiCostHelper")
              }
              disabled={data.kpis.aiCostUsdWindow == null}
            />
            <KpiTile
              label={t("dashboards.executive.kpis.windowDays")}
              value={String(windowDays)}
              helper={t("dashboards.executive.kpis.windowDaysHelper")}
            />
          </section>

          {/* Expiry cliffs */}
          <DashboardSection
            title={t("dashboards.executive.expiryCliffs.title")}
            description={t("dashboards.executive.expiryCliffs.description")}
          >
            <ExpiryCliffsBlock cliffs={data.kpis.expiryCliffs} />
          </DashboardSection>

          {/* Status + value distribution */}
          <div className="grid gap-3 lg:grid-cols-2">
            <DashboardSection
              title={t("dashboards.executive.contractsByStatus.title")}
            >
              {Object.keys(data.kpis.contractsByStatus).length === 0 ? (
                <DashboardEmptyState />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(data.kpis.contractsByStatus).map(
                    ([status, count]) => (
                      <li
                        key={status}
                        className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                      >
                        <span className="font-mono text-xs uppercase tracking-wider text-ink-subtle">
                          {t(`contractStatus.${status}`, {
                            defaultValue: status,
                          })}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-ink">
                          {formatNumber(count)}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </DashboardSection>

            <DashboardSection
              title={t("dashboards.executive.valueDistribution.title")}
              description={t(
                "dashboards.executive.valueDistribution.description",
              )}
            >
              <ValueDistributionBlock buckets={data.kpis.valueDistribution} />
            </DashboardSection>
          </div>

          {/* Top counterparties */}
          <DashboardSection
            title={t("dashboards.executive.topCounterparties.title")}
            description={t("dashboards.executive.topCounterparties.description")}
          >
            <TopCounterpartiesBlock rows={data.kpis.topCounterpartiesByValue5} />
          </DashboardSection>

          {/* Trends */}
          <div className="grid gap-3 lg:grid-cols-2">
            <DashboardSection
              title={t("dashboards.executive.trends.valueOverTimeTitle")}
            >
              <ValueOverTimeBlock points={data.trends.valueOverTimeByMonth} />
            </DashboardSection>

            <DashboardSection
              title={t("dashboards.executive.trends.contractsCreatedTitle")}
            >
              <ContractsByMonthBlock points={data.trends.contractsCreatedByMonth} />
            </DashboardSection>
          </div>

          {/* S9 — Mount existing M4 ExecutiveAnomaliesCard */}
          {anomaliesStats && (
            <ExecutiveAnomaliesCard
              stats={anomaliesStats}
              language={language}
              autoFetch
            />
          )}
        </>
      )}
    </motion.div>
  );
}

function ExpiryCliffsBlock({ cliffs }: { cliffs: ExecutiveExpiryCliffs }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-md border border-border bg-amber-tint/30 p-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-amber-ink">
          {t("dashboards.executive.expiryCliffs.next30d")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
          {formatNumber(cliffs.next30d)}
        </p>
      </div>
      <div className="rounded-md border border-border bg-amber-tint/20 p-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-amber-ink">
          {t("dashboards.executive.expiryCliffs.next60d")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
          {formatNumber(cliffs.next60d)}
        </p>
      </div>
      <div className="rounded-md border border-border bg-amber-tint/10 p-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-amber-ink">
          {t("dashboards.executive.expiryCliffs.next90d")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
          {formatNumber(cliffs.next90d)}
        </p>
      </div>
    </div>
  );
}

function ValueDistributionBlock({
  buckets,
}: {
  buckets: ValueDistributionBucket[];
}) {
  const { t } = useTranslation();
  if (buckets.length === 0) return <DashboardEmptyState />;
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <ul className="space-y-2">
      {buckets.map((b) => {
        const pct = (b.count / maxCount) * 100;
        return (
          <li key={b.bucket} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs text-ink-subtle">
                {t(`dashboards.executive.valueDistribution.bucket.${b.bucket}`, {
                  defaultValue: b.bucket,
                })}
              </span>
              <span className="text-sm font-semibold tabular-nums text-ink">
                {formatNumber(b.count)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-gold transition-all"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TopCounterpartiesBlock({
  rows,
}: {
  rows: CounterpartyConcentrationRow[];
}) {
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
              {t("dashboards.executive.topCounterparties.counterparty")}
            </th>
            <th className="py-2 pe-3 font-medium tabular-nums">
              {t("dashboards.executive.topCounterparties.totalValue")}
            </th>
            <th className="py-2 pe-3 font-medium tabular-nums">
              {t("dashboards.executive.topCounterparties.contractCount")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.counterpartyId}
              className="border-t border-border/60"
            >
              <td className="py-2 pe-3">
                <span className="font-mono text-xs text-ink-subtle">
                  {t("dashboards.executive.topCounterparties.idLabel", {
                    id: row.counterpartyId,
                  })}
                </span>
                <span className="ms-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  {t("dashboards.executive.topCounterparties.namePending")}
                </span>
              </td>
              <td className="py-2 pe-3 tabular-nums text-ink">
                {formatAed(row.totalValueAed)}
              </td>
              <td className="py-2 pe-3 tabular-nums text-ink">
                {formatNumber(row.contractCount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValueOverTimeBlock({ points }: { points: TrendMonthValueAed[] }) {
  const { t } = useTranslation();
  if (points.length === 0) return <DashboardEmptyState />;
  return (
    <table className="min-w-full text-xs">
      <thead>
        <tr className="text-left text-ink-subtle">
          <th className="py-1 pe-3 font-medium">{t("dashboards.common.month")}</th>
          <th className="py-1 pe-3 font-medium tabular-nums">
            {t("dashboards.common.totalValue")}
          </th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.month} className="border-t border-border/60">
            <td className="py-1 pe-3 font-mono text-ink">{p.month}</td>
            <td className="py-1 pe-3 tabular-nums text-ink">
              {formatAed(p.totalValueAed)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContractsByMonthBlock({ points }: { points: TrendMonthCount[] }) {
  const { t } = useTranslation();
  if (points.length === 0) return <DashboardEmptyState />;
  return (
    <table className="min-w-full text-xs">
      <thead>
        <tr className="text-left text-ink-subtle">
          <th className="py-1 pe-3 font-medium">{t("dashboards.common.month")}</th>
          <th className="py-1 pe-3 font-medium tabular-nums">
            {t("dashboards.common.count")}
          </th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.month} className="border-t border-border/60">
            <td className="py-1 pe-3 font-mono text-ink">{p.month}</td>
            <td className="py-1 pe-3 tabular-nums text-ink">
              {formatNumber(p.count)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ExecutiveDashboard;
