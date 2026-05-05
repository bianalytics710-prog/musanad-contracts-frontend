/**
 * AICostPanel (S11) — sidebar panel for the admin dashboard.
 *
 * Mode: NEW. Per DASH-OI-G this panel mounts INDEPENDENTLY into the admin
 * dashboard sidebar via React Query (separate query key) — it is NOT
 * bundled into the GET /admin payload. This keeps the admin dashboard
 * focused on operational KPIs while preserving an independent permission
 * gate (ai.observability.read).
 *
 *   GET /api/v1/dashboards/ai-cost-summary?windowDays=N
 *
 * windowDays default 30, max 90 — matches the M4 90-day cap (AC-S11-05).
 *
 * AC mapping:
 *   AC-S11-01..04 — KPI strip + top-prompts table.
 *   AC-S11-05 — windowDays in [1,90]; UI clamps via TimeRangeSelector
 *               maxWindowDays.
 *   AC-S11-04 — 403 when caller lacks ai.observability.read; surfaced
 *               via translateApiError.
 *   AC-S11-06 — cacheHitRatioOverall NULL when zero requests in window
 *               (S2-18) — render as "—".
 *   AC-S11-07 — totalCostUsd projected as USD with 2dp.
 *
 * 13-checklist: T1/T2/T3/T4/T5/T7/T11/T12.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiCostSummary } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  TimeRangeSelector,
  asWindowQuery,
  formatNumber,
  formatPercent,
  formatUsd,
  rangeFromWindowDays,
} from "./dashboard-primitives";
import type {
  AiCostTopPromptRow,
  DashboardRangeKey,
} from "@/types/entities/dashboards.types";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 90;

interface AICostPanelProps {
  /**
   * 'panel' (default) — compact sidebar panel.
   * 'page' — full-page view (used by /app/admin/ai/cost-report future
   *          variant if we want a standalone view; current use is panel).
   */
  variant?: "panel" | "page";
}

export function AICostPanel({ variant = "panel" }: AICostPanelProps) {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [range, setRange] = useState<DashboardRangeKey>(
    rangeFromWindowDays(DEFAULT_WINDOW_DAYS),
  );

  const { data, isLoading, isError, error, refetch } = useAiCostSummary(
    asWindowQuery(windowDays),
  );

  const isPage = variant === "page";

  return (
    <Card className={isPage ? "" : "h-full"}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
            <Coins className="h-4 w-4" aria-hidden />
          </span>
          {t("dashboards.aiCost.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <TimeRangeSelector
          range={range}
          windowDays={windowDays}
          onChange={({ range: r, windowDays: d }) => {
            setRange(r);
            setWindowDays(d);
          }}
          maxWindowDays={MAX_WINDOW_DAYS}
        />

        {isLoading && !data ? (
          <DashboardLoadingSkeleton rows={1} />
        ) : isError ? (
          <DashboardErrorState
            error={error}
            onRetry={() => void refetch()}
            fallbackKey="dashboards.aiCost.errors.loadFailed"
          />
        ) : !data ? (
          <DashboardEmptyState />
        ) : (
          <>
            <dl className="grid gap-2 sm:grid-cols-3">
              <KpiStrip
                label={t("dashboards.aiCost.totalCostUsdWindow")}
                value={formatUsd(data.totalCostUsdWindow)}
              />
              <KpiStrip
                label={t("dashboards.aiCost.totalRequestsWindow")}
                value={formatNumber(data.totalRequestsWindow)}
              />
              <KpiStrip
                label={t("dashboards.aiCost.cacheHitRatioOverall")}
                value={
                  data.cacheHitRatioOverall == null
                    ? "—"
                    : formatPercent(data.cacheHitRatioOverall)
                }
                helper={
                  data.cacheHitRatioOverall == null
                    ? t("dashboards.aiCost.noRequestsHelper")
                    : undefined
                }
              />
            </dl>

            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
                {t("dashboards.aiCost.topPromptsTitle")}
              </h3>
              <TopPromptsBlock rows={data.topPromptsByCost5} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KpiStrip({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-ink">
        {value}
      </dd>
      {helper && <p className="mt-0.5 text-[10px] text-ink-muted">{helper}</p>}
    </div>
  );
}

function TopPromptsBlock({ rows }: { rows: AiCostTopPromptRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <p className="mt-2 rounded-md border border-dashed border-border bg-card p-3 text-center text-xs text-ink-muted">
        {t("dashboards.aiCost.noPrompts")}
      </p>
    );
  }
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-ink-subtle">
            <th className="py-1 pe-3 font-medium">
              {t("dashboards.aiCost.promptId")}
            </th>
            <th className="py-1 pe-3 font-medium tabular-nums">
              {t("dashboards.aiCost.requestCount")}
            </th>
            <th className="py-1 pe-3 font-medium tabular-nums">
              {t("dashboards.aiCost.totalCostUsd")}
            </th>
            <th className="py-1 pe-3 font-medium tabular-nums">
              {t("dashboards.aiCost.cacheHitRatio")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.promptId} className="border-t border-border/60">
              <td className="py-1 pe-3 font-mono text-ink">{row.promptId}</td>
              <td className="py-1 pe-3 tabular-nums text-ink">
                {formatNumber(row.requestCount)}
              </td>
              <td className="py-1 pe-3 tabular-nums text-ink">
                {formatUsd(row.totalCostUsd)}
              </td>
              <td className="py-1 pe-3 tabular-nums text-ink">
                {row.cacheHitRatio == null
                  ? "—"
                  : formatPercent(row.cacheHitRatio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AICostPanel;
