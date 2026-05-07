/**
 * AdminDashboard (S1 + S13) — R-PA1 polish.
 *
 * Mode: REGENERATE → POLISHED. The Lovable AdminDashboard.tsx (450L) was
 * tightly supabase-coupled and pre-dated the v2.6 fn_dashboard_admin shape.
 * Rebuilt around the live endpoint:
 *
 *   GET /api/v1/dashboards/admin?windowDays=N
 *
 * R-PA1 adds:
 *   - Welcome strip (firstName, lastName, formatDate, formatHijriDate)
 *     mirroring the Executive / Legal Counsel / Recipient pattern.
 *   - H1 wording: "System overview" (Lovable parity, Q2=2b).
 *   - KPI delta indicators against kpiPrev (migration 095).
 *   - 4 system overview cards: System health summary, Pending admin actions,
 *     Top contract types, System activity feed.
 *
 * Story coverage:
 *   - S1  primary admin landing (insights chart layout)
 *   - S13 admin landing tile grid — same component, tile-grid variant.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Check,
  CircleCheck,
  ClipboardList,
  Database,
  FileSignature,
  ListChecks,
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
import { useAuthStore, selectUser } from "@/store/auth.store";
import { formatDate, formatDateTime, formatHijriDate } from "@/utils/datetime";
import type {
  AdminDashboardKpiPrev,
  AdminPendingActions,
  AdminSystemActivityRow,
  AdminSystemHealth,
  AdminTopContractTypeRow,
  DashboardRangeKey,
} from "@/types/entities/dashboards.types";

interface AdminDashboardProps {
  variant?: "insights" | "tile-grid";
}

const DEFAULT_WINDOW_DAYS = 30;

export function AdminDashboard({
  variant = "insights",
}: AdminDashboardProps) {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useAdminDashboard(
    asWindowQuery(windowDays),
  );

  const isTileGrid = variant === "tile-grid";
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
          {/* R-PA1 — welcome line + Hijri date strip mirroring LC / executive / recipient. */}
          <p className="text-xs text-ink-subtle">
            {user
              ? `${t("dashboards.common.welcome", { defaultValue: "Welcome back" })}, ${user.firstName} ${user.lastName} · ${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`
              : `${formatDate(nowISO)} · ${formatHijriDate(nowISO)}`}
          </p>
          {/* R-PA1 — H1 wording: "System overview" (Lovable parity, Q2=2b). */}
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {isTileGrid
              ? t("dashboards.admin.landingTitle", {
                  defaultValue: "Admin landing",
                })
              : t("dashboards.admin.title", {
                  defaultValue: "System overview",
                })}
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
          {/* R-PA1 — 8 KPI tiles with delta indicators vs kpiPrev. */}
          <section
            aria-label={t("dashboards.admin.kpiGroupLabel")}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile
              label={t("dashboards.admin.kpis.totalContractsActive")}
              value={formatNumber(data.kpis.totalContractsActive)}
              helper={formatCountDelta(
                data.kpis.totalContractsActive,
                data.kpiPrev?.totalContractsActive,
                t,
              )}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.expiringWithin30d")}
              value={formatNumber(data.kpis.expiringWithin30d)}
              helper={formatCountDelta(
                data.kpis.expiringWithin30d,
                data.kpiPrev?.expiringWithin30d,
                t,
              )}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.expiringWithin90d")}
              value={formatNumber(data.kpis.expiringWithin90d)}
              helper={formatCountDelta(
                data.kpis.expiringWithin90d,
                data.kpiPrev?.expiringWithin90d,
                t,
              )}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.pendingApprovals")}
              value={formatNumber(data.kpis.pendingApprovals)}
              helper={formatCountDelta(
                data.kpis.pendingApprovals,
                data.kpiPrev?.pendingApprovals,
                t,
              )}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.pendingSignatures")}
              value={formatNumber(data.kpis.pendingSignatures)}
              helper={formatCountDelta(
                data.kpis.pendingSignatures,
                data.kpiPrev?.pendingSignatures,
                t,
              )}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.openRegulatoryImpacts")}
              value={formatNumber(data.kpis.openRegulatoryImpacts)}
              helper={formatCountDelta(
                data.kpis.openRegulatoryImpacts,
                data.kpiPrev?.openRegulatoryImpacts,
                t,
              )}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.recentAuditEvents")}
              value={formatNumber(data.kpis.recentAuditEvents)}
              helper={formatCountDelta(
                data.kpis.recentAuditEvents,
                data.kpiPrev?.recentAuditEvents,
                t,
              )}
            />
            <KpiTile
              label={t("dashboards.admin.kpis.totalActiveUsers")}
              value={formatNumber(data.kpis.totalActiveUsers)}
              helper={formatCountDelta(
                data.kpis.totalActiveUsers,
                data.kpiPrev?.totalActiveUsers,
                t,
              )}
            />
          </section>

          {/* R-PA1 — 4 system overview cards. Each gracefully renders an
              empty state when the corresponding section is missing
              (server pre-095 fallback). */}
          <div className="grid gap-3 lg:grid-cols-2">
            <SystemHealthCard health={data.systemHealth} />
            <PendingAdminActionsCard pending={data.pendingAdminActions} />
            <TopContractTypesCard rows={data.topContractTypes5} />
            <SystemActivityCard rows={data.systemActivity14d} />
          </div>

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

// ─── R-PA1 system overview cards ────────────────────────────────────────────

function SystemHealthCard({ health }: { health: AdminSystemHealth | undefined }) {
  const { t } = useTranslation();
  const isOk = health?.dbStatus === "ok";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Database className="h-4 w-4 text-ink-subtle" />
        <CardTitle className="text-sm font-semibold">
          {t("dashboards.admin.systemHealth.title", {
            defaultValue: "System health",
          })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!health ? (
          <DashboardEmptyState />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span
                className={
                  isOk
                    ? "inline-flex h-2 w-2 rounded-full bg-sage"
                    : "inline-flex h-2 w-2 rounded-full bg-terracotta"
                }
              />
              <span className="text-ink-muted">
                {t("dashboards.admin.systemHealth.dbLabel", {
                  defaultValue: "Database",
                })}
              </span>
              <span className="ml-auto font-mono text-xs uppercase tracking-wider text-ink">
                {health.dbStatus}
              </span>
            </div>
            <HealthRow
              label={t("dashboards.admin.systemHealth.latestMigration", {
                defaultValue: "Latest migration",
              })}
              value={`#${health.latestMigration}`}
            />
            <HealthRow
              label={t("dashboards.admin.systemHealth.auditEvents24h", {
                defaultValue: "Audit events (24h)",
              })}
              value={formatNumber(health.auditEvents24h)}
            />
            <HealthRow
              label={t("dashboards.admin.systemHealth.aiErrors24h", {
                defaultValue: "AI errors (24h)",
              })}
              value={formatNumber(health.aiErrors24h)}
              tone={health.aiErrors24h > 0 ? "warn" : undefined}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HealthRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-muted">{label}</span>
      <span
        className={
          tone === "warn"
            ? "ml-auto font-semibold tabular-nums text-terracotta"
            : "ml-auto font-semibold tabular-nums text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}

function PendingAdminActionsCard({
  pending,
}: {
  pending: AdminPendingActions | undefined;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <ListChecks className="h-4 w-4 text-ink-subtle" />
        <CardTitle className="text-sm font-semibold">
          {t("dashboards.admin.pendingActions.title", {
            defaultValue: "Pending admin actions",
          })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!pending ? (
          <DashboardEmptyState />
        ) : (
          <ul className="space-y-2 text-sm">
            <PendingRow
              label={t("dashboards.admin.pendingActions.approvals", {
                defaultValue: "Approvals",
              })}
              count={pending.pendingApprovals}
              to="/app/approvals"
            />
            <PendingRow
              label={t("dashboards.admin.pendingActions.signatures", {
                defaultValue: "Signatures",
              })}
              count={pending.pendingSignatures}
              to="/app/signatures"
            />
            <PendingRow
              label={t("dashboards.admin.pendingActions.imports", {
                defaultValue: "Imports",
              })}
              count={pending.pendingImports}
              to="/app/admin/imports"
            />
            <PendingRow
              label={t("dashboards.admin.pendingActions.regulatoryImpacts", {
                defaultValue: "Open regulatory impacts",
              })}
              count={pending.openImpacts}
              to="/app/regulatory-radar"
            />
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PendingRow({
  label,
  count,
  to,
}: {
  label: string;
  count: number;
  to: string;
}) {
  const isZero = count === 0;
  return (
    <li>
      <a
        href={to}
        className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 transition hover:border-gold hover:bg-gold/5"
      >
        <span className="text-ink-muted">{label}</span>
        {isZero ? (
          <span className="inline-flex items-center gap-1 text-xs text-sage">
            <Check className="h-3.5 w-3.5" />
            {formatNumber(0)}
          </span>
        ) : (
          <span className="font-semibold tabular-nums text-ink">
            {formatNumber(count)}
          </span>
        )}
      </a>
    </li>
  );
}

function TopContractTypesCard({
  rows,
}: {
  rows: AdminTopContractTypeRow[] | undefined;
}) {
  const { t } = useTranslation();
  const list = rows ?? [];
  const max = list.reduce((m, r) => Math.max(m, r.count), 0);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <ClipboardList className="h-4 w-4 text-ink-subtle" />
        <CardTitle className="text-sm font-semibold">
          {t("dashboards.admin.topContractTypes.title", {
            defaultValue: "Top contract types",
          })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <DashboardEmptyState />
        ) : (
          <ul className="space-y-2 text-sm">
            {list.map((row) => {
              const pct = max > 0 ? Math.round((row.count / max) * 100) : 0;
              return (
                <li key={row.contractType} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-ink">
                      {t(`contractType.${row.contractType}`, {
                        defaultValue: row.contractType,
                      })}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-ink-muted">
                      {formatNumber(row.count)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SystemActivityCard({
  rows,
}: {
  rows: AdminSystemActivityRow[] | undefined;
}) {
  const { t } = useTranslation();
  const list = rows ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Activity className="h-4 w-4 text-ink-subtle" />
        <CardTitle className="text-sm font-semibold">
          {t("dashboards.admin.systemActivity.title", {
            defaultValue: "System activity",
          })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <DashboardEmptyState />
        ) : (
          <ul className="space-y-2 text-sm">
            {list.map((row, i) => (
              <li
                key={`${row.entityType}-${row.entityId ?? i}-${row.occurredAt}`}
                className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <span className="mt-0.5 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {row.headline}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {formatDateTime(row.occurredAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── KPI delta helpers (R-PA1; mirrors ExecutiveDashboard) ──────────────────

function formatCountDelta(
  current: number,
  previous: number | undefined,
  t: (key: string, opts?: { defaultValue?: string; n?: string }) => string,
): string | undefined {
  if (previous === undefined || previous === null) return undefined;
  const diff = current - previous;
  if (diff === 0) return undefined;
  const sign = diff > 0 ? "+" : "";
  const display = `${sign}${diff}`;
  return t("dashboards.admin.kpis.deltaCountVsPrev", {
    defaultValue: `${display} vs prev`,
    n: display,
  });
}

// ─── Trend charts (unchanged from prior body) ──────────────────────────────

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
