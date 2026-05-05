/**
 * AdminDashboard (S1 + S13).
 *
 * Mode: REGENERATE. The Lovable AdminDashboard.tsx (450L) was tightly
 * supabase-coupled and pre-dated the v2.6 fn_dashboard_admin shape. We
 * rebuild around the live endpoint:
 *
 *   GET /api/v1/dashboards/admin?windowDays=N
 *
 * Story coverage:
 *   - S1  primary admin landing (insights chart layout)
 *   - S13 admin landing tile grid — same component, tile-grid variant via
 *         the `variant="tile-grid"` prop (mounted at /app/admin/index.tsx
 *         or /app/dashboards/admin.tsx — both consume this component).
 *
 * Side panel: AICostPanel mounts independently per DASH-OI-G — the panel
 * is wired in the parent route file rather than embedded here.
 *
 * 13-checklist:
 *   T1/T2 — service + React Query hook (useAdminDashboard).
 *   T3 — every label uses t().
 *   T4 — explicit loading / error / empty branches.
 *   T5 — semantic Tailwind tokens (ink, ink-muted, ink-subtle, gold,
 *        amber-tint, sage-tint, terracotta-tint).
 *   T6 — aria-live status region for window selector; aria-disabled on
 *        placeholder tiles.
 *   T7 — no `any`; types from dashboards.types.ts.
 *   T11 — wrapped at the route level (admin.tsx).
 *   T12 — formatDateTime / formatAed / formatNumber utilities.
 *
 * AC mapping:
 *   AC-S1-01..03 — KPI grid + window pills (default last_30d).
 *   AC-S1-04 — expiringWithin30d <= expiringWithin90d (server-validated).
 *   AC-S1-05 — trends section (contractsCreatedByDay + approvalDecisionsByDay).
 *   AC-S1-06 — windowDays validation surfaces 400 via translateApiError.
 *   AC-S1-07 — DB error surfaces a redacted user message (no raw text leak).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  FileSignature,
  ScrollText,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminDashboard } from "../hooks/useDashboards";
import {
  DashboardErrorState,
  DashboardLoadingSkeleton,
  DashboardEmptyState,
  DashboardSection,
  KpiTile,
  TimeRangeSelector,
  asWindowQuery,
  formatNumber,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import type { DashboardRangeKey } from "@/types/entities/dashboards.types";

interface AdminDashboardProps {
  /**
   * 'insights' (S1) — chart-focused layout.
   * 'tile-grid' (S13) — admin landing dense tile grid.
   * Default: 'insights'.
   */
  variant?: "insights" | "tile-grid";
}

const DEFAULT_WINDOW_DAYS = 30;

export function AdminDashboard({
  variant = "insights",
}: AdminDashboardProps) {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useAdminDashboard(
    asWindowQuery(windowDays),
  );

  const isTileGrid = variant === "tile-grid";

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
            {isTileGrid
              ? t("dashboards.admin.landingTitle")
              : t("dashboards.admin.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t("dashboards.admin.subtitle")}
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
          fallbackKey="dashboards.admin.errors.loadFailed"
        />
      ) : !data ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* KPI grid */}
          <section
            aria-label={t("dashboards.admin.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t("dashboards.admin.kpis.totalContractsActive")}
              value={formatNumber(data.kpis.totalContractsActive)}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.expiringWithin30d")}
              value={formatNumber(data.kpis.expiringWithin30d)}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.expiringWithin90d")}
              value={formatNumber(data.kpis.expiringWithin90d)}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.pendingApprovals")}
              value={formatNumber(data.kpis.pendingApprovals)}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.pendingSignatures")}
              value={formatNumber(data.kpis.pendingSignatures)}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.openRegulatoryImpacts")}
              value={formatNumber(data.kpis.openRegulatoryImpacts)}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.recentAuditEvents")}
              value={formatNumber(data.kpis.recentAuditEvents)}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.totalActiveUsers")}
              value={formatNumber(data.kpis.totalActiveUsers)}
            />
          </section>

          {/* Status breakdown */}
          <DashboardSection
            title={t("dashboards.admin.contractsByStatus.title")}
            description={t("dashboards.admin.contractsByStatus.description")}
          >
            {Object.keys(data.kpis.totalContractsByStatus).length === 0 ? (
              <DashboardEmptyState />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(data.kpis.totalContractsByStatus).map(
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

          {/* Trends — recharts */}
          {!isTileGrid && (
            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-1 text-sm font-semibold text-ink">
                  {t("dashboards.admin.trends.contractsCreatedTitle")}
                </h3>
                <p className="mb-3 text-xs text-ink-subtle">
                  {t("dashboards.admin.trends.contractsCreatedDescription")}
                </p>
                <ContractsCreatedChart points={data.trends.contractsCreatedByDay} />
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-1 text-sm font-semibold text-ink">
                  {t("dashboards.admin.trends.decisionsTitle")}
                </h3>
                <p className="mb-3 text-xs text-ink-subtle">
                  {t("dashboards.admin.trends.decisionsDescription")}
                </p>
                <DecisionsChart points={data.trends.approvalDecisionsByDay} />
              </section>
            </div>
          )}

          {/* Tile-grid variant (S13) — quick action launcher */}
          {isTileGrid && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  {t("dashboards.admin.tileGrid.quickActionsTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <TileGridLink
                    icon={<ClipboardList className="h-4 w-4" />}
                    label={t("dashboards.admin.tileGrid.contracts")}
                    to="/app/contracts"
                  />
                  <TileGridLink
                    icon={<CircleCheck className="h-4 w-4" />}
                    label={t("dashboards.admin.tileGrid.approvals")}
                    to="/app/approvals"
                  />
                  <TileGridLink
                    icon={<FileSignature className="h-4 w-4" />}
                    label={t("dashboards.admin.tileGrid.regulatoryRadar")}
                    to="/app/regulatory-radar"
                  />
                  <TileGridLink
                    icon={<ScrollText className="h-4 w-4" />}
                    label={t("dashboards.admin.tileGrid.imports")}
                    to="/app/admin/imports"
                  />
                  <TileGridLink
                    icon={<Users className="h-4 w-4" />}
                    label={t("dashboards.admin.tileGrid.aiRequests")}
                    to="/app/admin/ai/requests"
                  />
                  <TileGridLink
                    icon={<AlertTriangle className="h-4 w-4" />}
                    label={t("dashboards.admin.tileGrid.health")}
                    to="/app/admin/health"
                  />
                  <TileGridLink
                    icon={<CalendarClock className="h-4 w-4" />}
                    label={t("dashboards.admin.tileGrid.aiCosts")}
                    to="/app/admin/ai/cost-report"
                  />
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}

function ContractsCreatedChart({
  points,
}: {
  points: Array<{ date: string; count: number }>;
}) {
  if (points.length === 0) return <DashboardEmptyState />;
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
        >
          <defs>
            <linearGradient id="adminCreatedArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B8935A" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#B8935A" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#B8935A"
            strokeWidth={2}
            fill="url(#adminCreatedArea)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DecisionsChart({
  points,
}: {
  points: Array<{ date: string; approved: number; rejected: number }>;
}) {
  const { t } = useTranslation();
  if (points.length === 0) return <DashboardEmptyState />;
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
            }}
          />
          <Bar
            dataKey="approved"
            stackId="a"
            fill="#5B8374"
            name={t("dashboards.admin.trends.approved", { defaultValue: "Approved" })}
          />
          <Bar
            dataKey="rejected"
            stackId="a"
            fill="#C4634D"
            name={t("dashboards.admin.trends.rejected", { defaultValue: "Rejected" })}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TileGridLink({
  icon,
  label,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
}) {
  return (
    <li>
      <a
        href={to}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-ink transition hover:border-gold hover:bg-gold/5"
      >
        <span className="text-ink-subtle">{icon}</span>
        <span>{label}</span>
      </a>
    </li>
  );
}

export default AdminDashboard;
