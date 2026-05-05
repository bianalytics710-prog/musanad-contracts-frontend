/**
 * InsightsRouter (S6).
 *
 * Mode: NEW. Auto-redirect entry point. Calls GET /api/v1/dashboards/router
 * which returns { userId, primaryRole, dashboardKey, permissionsSummary }
 * (db-design.md §3.6 post-Patch-Round-1, S2-22-WARN-3-FIX). Decision tree:
 *   platform_admin / Super Admin → 'admin'
 *   contract_drafter             → 'drafter'
 *   contract_approver*           → 'approver'
 *   legal_counsel                → 'legal_counsel'
 *   executive                    → 'executive'
 *   contract_recipient (default) → 'recipient'
 *
 * AC mapping:
 *   AC-S6-01..04 — single GET; client redirects to the named dashboard.
 *   AC-S6-05 — 401 when JWT invalid (the apiClient interceptor redirects
 *              to /auth/login automatically; nothing extra to do here).
 *
 * Renders a friendly redirect skeleton while the call is in flight.
 *
 * 13-checklist: T1/T2/T3/T4/T7/T11.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useDashboardRouter } from "../hooks/useDashboards";
import {
  DashboardErrorState,
  DashboardLoadingSkeleton,
} from "./dashboard-primitives";
import type { DashboardKey } from "@/types/entities/dashboards.types";

const DASHBOARD_TO_PATH: Record<DashboardKey, string> = {
  admin: "/app/dashboards/admin",
  drafter: "/app/dashboards/drafter",
  approver: "/app/dashboards/approver",
  legal_counsel: "/app/dashboards/legal-counsel",
  recipient: "/app/dashboards/recipient",
  executive: "/app/dashboards/executive",
};

export function InsightsRouter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useDashboardRouter();

  // Effect: navigate once we know which dashboard to show.
  useEffect(() => {
    if (data) {
      const target = DASHBOARD_TO_PATH[data.dashboardKey];
      if (target) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void navigate({ to: target as any, replace: true });
      }
    }
  }, [data, navigate]);

  if (isError) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {t("dashboards.insightsRouter.title")}
        </h1>
        <DashboardErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackKey="dashboards.insightsRouter.errors.loadFailed"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        {t("dashboards.insightsRouter.title")}
      </h1>
      <p className="text-sm text-ink-muted">
        {data
          ? t("dashboards.insightsRouter.redirecting", {
              dashboard: t(`dashboards.insightsRouter.target.${data.dashboardKey}`),
            })
          : t("dashboards.insightsRouter.detecting")}
      </p>
      {(isLoading || !data) && <DashboardLoadingSkeleton rows={1} />}
    </div>
  );
}

export default InsightsRouter;
