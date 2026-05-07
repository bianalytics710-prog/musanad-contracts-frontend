/**
 * AdminAICostDashboard (M4 — S12).
 *
 * NEW — no Lovable precedent. Admin cost dashboard rendering
 * GET /api/v1/admin/ai/cost-report. 90-day max range enforced FE-side
 * (mirrors BE Zod superRefine in schemas.ts).
 *
 * Permission: ai.observability.read.
 *
 * Renders:
 *   - Per-prompt cost table (always shown)
 *   - Cache-hit-ratio gauge per prompt
 *   - Token totals per prompt
 *   - Optional groupByUser drilldown
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { ApiError } from "@/lib/api-client";
import { useAuthStore, selectHasPermission } from "@/store/auth.store";
import { useAdminAiCostReport } from "@/features/admin-ai/hooks/useAdminAi";
import type { AiCostReportQuery } from "@/types/entities/ai.types";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const MAX_RANGE_DAYS = 90;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatUsdMicros(micros: number | null | undefined): string {
  if (micros == null) return "$0.00";
  const usd = micros / 1_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(usd);
}

function formatRatio(r: number | null | undefined): string {
  if (r == null) return "—";
  return `${(r * 100).toFixed(1)}%`;
}

export function AdminAICostDashboard() {
  const { t } = useTranslation();
  const hasPermission = useAuthStore(selectHasPermission("ai.observability.read"));

  const [fromDate, setFromDate] = useState(isoDaysAgo(30));
  const [toDate, setToDate] = useState(isoDaysAgo(0));
  const [groupByUser, setGroupByUser] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validatedRange = useMemo<{
    valid: boolean;
    diffDays: number;
  }>(() => {
    if (!ISO_DATE_REGEX.test(fromDate) || !ISO_DATE_REGEX.test(toDate)) {
      return { valid: false, diffDays: 0 };
    }
    const f = new Date(fromDate).getTime();
    const tt = new Date(toDate).getTime();
    if (Number.isNaN(f) || Number.isNaN(tt) || f > tt) {
      return { valid: false, diffDays: 0 };
    }
    const diffDays = Math.floor((tt - f) / MS_PER_DAY);
    return { valid: diffDays <= MAX_RANGE_DAYS, diffDays };
  }, [fromDate, toDate]);

  const query: AiCostReportQuery = useMemo(
    () => ({ fromDate, toDate, groupByUser }),
    [fromDate, toDate, groupByUser],
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminAiCostReport(query, {
      enabled: hasPermission && validatedRange.valid,
    });

  const onApply = () => {
    if (!validatedRange.valid) {
      setValidationError(
        validatedRange.diffDays > MAX_RANGE_DAYS
          ? t("admin.ai.cost.errors.rangeTooLong", { max: MAX_RANGE_DAYS })
          : t("admin.ai.cost.errors.invalidRange"),
      );
      return;
    }
    setValidationError(null);
    void refetch();
  };

  if (!hasPermission) {
    return (
      <div className="mx-auto w-full max-w-[960px] p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("admin.ai.cost.forbidden")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = data?.data ?? [];
  const totalCost = rows.reduce((acc, r) => acc + r.totalCostUsdMicros, 0);
  const totalSuccess = rows.reduce((acc, r) => acc + r.successCount, 0);
  const totalError = rows.reduce((acc, r) => acc + r.errorCount, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-4 p-6"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("admin.ai.cost.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.ai.cost.subtitle", { max: MAX_RANGE_DAYS })}
        </p>
      </header>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="ai-cost-from"
              className="block text-xs font-medium text-foreground"
            >
              {t("admin.ai.cost.filters.fromDate")}
            </label>
            <input
              id="ai-cost-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label
              htmlFor="ai-cost-to"
              className="block text-xs font-medium text-foreground"
            >
              {t("admin.ai.cost.filters.toDate")}
            </label>
            <input
              id="ai-cost-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={groupByUser}
                onChange={(e) => setGroupByUser(e.target.checked)}
              />
              {t("admin.ai.cost.filters.groupByUser")}
            </label>
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onApply}
              disabled={isFetching || !validatedRange.valid}
            >
              {t("admin.ai.cost.apply")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching || !validatedRange.valid}
              aria-label={t("common.retry")}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>

      {validationError && (
        <Card role="alert" className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 text-sm text-destructive">
            {validationError}
          </CardContent>
        </Card>
      )}

      {!validatedRange.valid && !validationError && (
        <Card>
          <CardContent className="p-3 text-xs text-muted-foreground">
            {t("admin.ai.cost.errors.adjustRange", { max: MAX_RANGE_DAYS })}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      )}

      {isError && (
        <Card role="alert" className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            <p>{translateApiError(error as ApiError, t)}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 font-medium underline-offset-2 hover:underline"
            >
              {t("common.retry")}
            </button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryStat
              label={t("admin.ai.cost.summary.totalSpend")}
              value={formatUsdMicros(totalCost)}
            />
            <SummaryStat
              label={t("admin.ai.cost.summary.totalSuccess")}
              value={String(totalSuccess)}
            />
            <SummaryStat
              label={t("admin.ai.cost.summary.totalError")}
              value={String(totalError)}
            />
          </div>

          {rows.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {t("admin.ai.cost.empty")}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">
                        {t("admin.ai.cost.col.prompt")}
                      </th>
                      {groupByUser && (
                        <th className="px-3 py-2">
                          {t("admin.ai.cost.col.actor")}
                        </th>
                      )}
                      <th className="px-3 py-2">
                        {t("admin.ai.cost.col.cost")}
                      </th>
                      <th className="px-3 py-2">
                        {t("admin.ai.cost.col.tokensIn")}
                      </th>
                      <th className="px-3 py-2">
                        {t("admin.ai.cost.col.tokensOut")}
                      </th>
                      <th className="px-3 py-2">
                        {t("admin.ai.cost.col.success")}
                      </th>
                      <th className="px-3 py-2">
                        {t("admin.ai.cost.col.error")}
                      </th>
                      <th className="px-3 py-2">
                        {t("admin.ai.cost.col.cacheHit")}
                      </th>
                      <th className="px-3 py-2">
                        {t("admin.ai.cost.col.avgLatency")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row, i) => (
                      <tr
                        key={`${row.promptId}-${row.actor?.id ?? "all"}-${i}`}
                        className="hover:bg-muted/30"
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.promptId}
                        </td>
                        {groupByUser && (
                          <td className="px-3 py-2 text-xs">
                            {row.actor
                              ? `${row.actor.fullName} (#${row.actor.id})`
                              : t("admin.ai.cost.noActor")}
                          </td>
                        )}
                        <td className="px-3 py-2 font-mono text-xs">
                          {formatUsdMicros(row.totalCostUsdMicros)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {(row.totalTokensInput ?? 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {(row.totalTokensOutput ?? 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.successCount}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.errorCount}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {formatRatio(row.cacheHitRatio)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.avgLatencyMs == null
                            ? "—"
                            : `${Math.round(row.avgLatencyMs)} ms`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
