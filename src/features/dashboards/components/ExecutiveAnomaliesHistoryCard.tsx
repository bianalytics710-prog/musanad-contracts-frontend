/**
 * ExecutiveAnomaliesHistoryCard (S8) — standalone history viewer for the
 * cached AI executive anomalies.
 *
 * Mode: NEW (no Lovable equivalent).
 *
 *   GET /api/v1/dashboards/executive/anomalies-history?limit=N
 *
 * Reads the cached anomaly insights from M4 ai_insight (entityType=
 * 'executive_anomalies'). Returns an empty array (NOT 404) when cache
 * empty per AC-S8-02.
 *
 * The "regenerate" action delegates to the M4 mutation
 * useAiExecutiveAnomalies (POST /api/v1/ai/executive-anomalies); we do
 * NOT redefine that endpoint in M6. The S7 ExecutiveDashboard already
 * mounts the M4 ExecutiveAnomaliesCard which owns the live regenerate
 * UX — this S8 history card is read-only history, independent of S7.
 *
 * 13-checklist: T1/T2/T3/T4/T5/T6/T7/T11/T12.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExecutiveAnomaliesHistory } from "../hooks/useDashboards";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingSkeleton,
  DashboardSection,
} from "./dashboard-primitives";
import { formatDateTime } from "@/utils/datetime";
import type { ExecutiveAnomaly } from "@/types/entities/dashboards.types";
import { cn } from "@/lib/utils";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-terracotta",
  warning: "bg-amber",
  medium: "bg-amber",
  info: "bg-muted-foreground",
  low: "bg-sage",
};

function dotClass(severity: string): string {
  return SEVERITY_DOT[severity.toLowerCase()] ?? "bg-muted-foreground";
}

export function ExecutiveAnomaliesHistoryCard() {
  const { t, i18n } = useTranslation();
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const isAr = i18n.language?.startsWith("ar");

  const { data, isLoading, isError, error, refetch, isFetching } =
    useExecutiveAnomaliesHistory({ limit });

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
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {t("dashboards.executiveAnomalies.title")}
            </h1>
            <p className="text-xs text-ink-muted">
              {t("dashboards.executiveAnomalies.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider">
              {t("dashboards.executiveAnomalies.limitLabel")}
            </span>
            <input
              type="number"
              min={1}
              max={MAX_LIMIT}
              value={limit}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(next)) return;
                setLimit(Math.min(Math.max(next, 1), MAX_LIMIT));
              }}
              className="w-20 rounded-md border border-border bg-card px-2 py-1 text-sm text-ink focus-visible:border-gold focus-visible:outline-none"
              aria-label={t("dashboards.executiveAnomalies.limitLabel")}
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t("dashboards.executiveAnomalies.refreshAria")}
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                isFetching && "animate-spin",
              )}
              aria-hidden
            />
            {t("common.retry")}
          </Button>
        </div>
      </header>

      <DashboardSection
        title={t("dashboards.executiveAnomalies.historyTitle")}
        description={t("dashboards.executiveAnomalies.historyDescription")}
      >
        {isLoading && !data ? (
          <DashboardLoadingSkeleton rows={1} />
        ) : isError ? (
          <DashboardErrorState
            error={error}
            onRetry={() => void refetch()}
            fallbackKey="dashboards.executiveAnomalies.errors.loadFailed"
          />
        ) : !data || data.anomalies.length === 0 ? (
          <DashboardEmptyState
            title={t("dashboards.executiveAnomalies.emptyTitle")}
            description={t("dashboards.executiveAnomalies.emptyDescription")}
          />
        ) : (
          <ul role="list" className="space-y-2">
            {data.anomalies.map((a) => (
              <AnomalyRow key={a.id} anomaly={a} isAr={isAr ?? false} />
            ))}
          </ul>
        )}
      </DashboardSection>
    </motion.div>
  );
}

function AnomalyRow({
  anomaly,
  isAr,
}: {
  anomaly: ExecutiveAnomaly;
  isAr: boolean;
}) {
  const { t } = useTranslation();
  const summary = isAr
    ? anomaly.summaryAr ?? anomaly.summaryEn
    : anomaly.summaryEn ?? anomaly.summaryAr;

  return (
    <li
      role="listitem"
      className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm"
    >
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          dotClass(anomaly.severity),
        )}
        aria-hidden
        title={anomaly.severity}
      />
      <div className="min-w-0 flex-1">
        <p className="text-ink" dir={isAr ? "rtl" : "ltr"}>
          {summary ?? t("dashboards.executiveAnomalies.unsummarized")}
        </p>
        <p className="mt-1 text-[11px] text-ink-muted" dir="ltr">
          {t("dashboards.executiveAnomalies.detectedAt")}:{" "}
          {formatDateTime(anomaly.detectedAt)}
          {" · "}
          <span className="font-mono uppercase tracking-wider">
            {anomaly.severity}
          </span>
        </p>
      </div>
    </li>
  );
}

export default ExecutiveAnomaliesHistoryCard;
