/**
 * AdminHealth (S12) — admin observability status page.
 *
 * Mode: NEW. Distinct from the public M0 liveness endpoint at /api/health
 * (no version prefix; no auth) — this is admin-scoped at /api/v1/admin/health
 * and requires platform_admin / Super Admin role.
 *
 *   GET /api/v1/admin/health
 *
 * Patch Round 1 (S2-22-WARN-2-FIX): the audit-block (errorCountLastHour +
 * lastErrorAt) was DROPPED — audit_log.action enum is INSERT/UPDATE/DELETE
 * only. Error signal sourced from the AI probe (lastFailureAt /
 * estimatedHealthy).
 *
 * AC mapping:
 *   AC-S12-01..03 — db / ai / overall blocks.
 *   AC-S12-04 — db.latestMigration NULL when schema_migrations_select_admin
 *               policy missing (DN-G); FE renders "—" with hint.
 *   AC-S12-05..06 — ai.estimatedHealthy boolean rendered as ok/degraded.
 *   AC-S12-07 — 403 when caller is not platform_admin / Super Admin.
 *
 * Refresh cadence: 60s automatic via React Query refetchInterval. Manual
 * refresh available via the refetch button.
 *
 * 13-checklist: T1/T2/T3/T4/T5/T7/T11/T12.
 */

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminHealth } from "../hooks/useDashboards";
import {
  DashboardErrorState,
  DashboardLoadingSkeleton,
} from "./dashboard-primitives";
import { formatDateTime } from "@/utils/datetime";
import type {
  HealthStatusOverall,
  HealthCheckSnapshot,
} from "@/types/entities/dashboards.types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<HealthStatusOverall, string> = {
  ok: "border-sage bg-sage-tint/40 text-sage-ink",
  degraded: "border-amber bg-amber-tint/40 text-amber-ink",
  unhealthy: "border-destructive bg-destructive/5 text-destructive",
};

function StatusIcon({ status }: { status: HealthStatusOverall }) {
  if (status === "ok")
    return <CheckCircle2 className="h-5 w-5" aria-hidden />;
  if (status === "degraded")
    return <AlertTriangle className="h-5 w-5" aria-hidden />;
  return <XCircle className="h-5 w-5" aria-hidden />;
}

export function AdminHealth() {
  const { t } = useTranslation();

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminHealth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4 p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            <Activity className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {t("dashboards.adminHealth.title")}
            </h1>
            <p className="text-xs text-ink-muted">
              {t("dashboards.adminHealth.subtitle")}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label={t("dashboards.adminHealth.refreshAria")}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
            aria-hidden
          />
          {t("common.retry")}
        </Button>
      </header>

      {isLoading && !data ? (
        <DashboardLoadingSkeleton rows={1} />
      ) : isError ? (
        <DashboardErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackKey="dashboards.adminHealth.errors.loadFailed"
        />
      ) : !data ? null : (
        <HealthBlocks snapshot={data} />
      )}
    </motion.div>
  );
}

function HealthBlocks({ snapshot }: { snapshot: HealthCheckSnapshot }) {
  const { t } = useTranslation();

  return (
    <>
      {/* Overall banner */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-3 rounded-md border px-4 py-3",
          STATUS_TONE[snapshot.overall],
        )}
      >
        <StatusIcon status={snapshot.overall} />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider">
            {t(`dashboards.adminHealth.overall.${snapshot.overall}`)}
          </p>
          <p className="text-xs">
            {t("dashboards.adminHealth.overallDescription")}
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* DB block */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t("dashboards.adminHealth.db.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row
                label={t("dashboards.adminHealth.db.status")}
                value={
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
                      snapshot.db.status === "ok"
                        ? "bg-sage-tint/60 text-sage-ink"
                        : "bg-amber-tint/60 text-amber-ink",
                    )}
                  >
                    {t(`dashboards.adminHealth.db.statusValue.${snapshot.db.status}`)}
                  </span>
                }
              />
              <Row
                label={t("dashboards.adminHealth.db.latestMigration")}
                value={
                  snapshot.db.latestMigration == null ? (
                    <span
                      className="text-ink-muted"
                      title={t("dashboards.adminHealth.db.latestMigrationNullHint")}
                    >
                      —
                    </span>
                  ) : (
                    <span className="font-mono tabular-nums text-ink">
                      {snapshot.db.latestMigration}
                    </span>
                  )
                }
              />
              <Row
                label={t("dashboards.adminHealth.db.currentTimestamp")}
                value={
                  <span className="text-ink">
                    {formatDateTime(snapshot.db.currentTimestamp)}
                  </span>
                }
              />
            </dl>
          </CardContent>
        </Card>

        {/* AI block */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t("dashboards.adminHealth.ai.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row
                label={t("dashboards.adminHealth.ai.estimatedHealthy")}
                value={
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
                      snapshot.ai.estimatedHealthy
                        ? "bg-sage-tint/60 text-sage-ink"
                        : "bg-amber-tint/60 text-amber-ink",
                    )}
                  >
                    {snapshot.ai.estimatedHealthy
                      ? t("dashboards.adminHealth.ai.healthy")
                      : t("dashboards.adminHealth.ai.degraded")}
                  </span>
                }
              />
              <Row
                label={t("dashboards.adminHealth.ai.lastSuccessfulRequestAt")}
                value={
                  <span className="text-ink">
                    {formatDateTime(snapshot.ai.lastSuccessfulRequestAt)}
                  </span>
                }
              />
              <Row
                label={t("dashboards.adminHealth.ai.lastFailureAt")}
                value={
                  <span className="text-ink">
                    {formatDateTime(snapshot.ai.lastFailureAt)}
                  </span>
                }
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1 last:border-b-0 last:pb-0">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
        {label}
      </dt>
      <dd className="text-end">{value}</dd>
    </div>
  );
}

export default AdminHealth;
