/**
 * ExecutiveAnomaliesCard (M4 — S3).
 *
 * Mode: REGENERATE — section-level harden of Lovable's ExecutiveDashboard
 * (1825 lines). Per audit-report Section 4 the AI anomalies block is one
 * card section inside that dashboard; the rest of the dashboard is
 * untouched in M4 scope. Lovable's anomaly block invoked supabase edge fn
 * directly with a different payload shape — incompatible with M4's POST
 * /api/v1/ai/executive-anomalies which takes a structured stats object.
 *
 * Renders 4 anomaly types per AC-S3-05 (max 4 enforced server-side).
 *
 * Caller passes the precomputed stats from the dashboard's existing data
 * widgets (active value, expiry cliffs, supplier concentration). Re-firing
 * is cheap because the BE caches via ai_insight (1h TTL).
 *
 * SECURITY:
 *   - stats may include sensitive aggregates — never console-logged.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAiExecutiveAnomalies } from "@/features/ai/hooks/useAi";
import { formatDateTime } from "@/utils/datetime";
import type {
  AiExecutiveAnomaliesStats,
  AiLanguage,
} from "@/types/entities/ai.types";

interface Props {
  stats: AiExecutiveAnomaliesStats;
  language: AiLanguage;
  dateRange?: { fromDate: string; toDate: string };
  /**
   * Auto-fetch on mount + when stats change. Pass false to defer to a
   * manual click (e.g. when stats are still loading upstream).
   */
  autoFetch?: boolean;
}

export function ExecutiveAnomaliesCard({
  stats,
  language,
  dateRange,
  autoFetch = true,
}: Props) {
  const { t } = useTranslation();
  const mutation = useAiExecutiveAnomalies();

  const trigger = () => {
    mutation.mutate({ stats, language, dateRange });
  };

  useEffect(() => {
    if (autoFetch) trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, language, JSON.stringify(stats)]);

  const data = mutation.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          {t("ai.executive.title")}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={trigger}
          disabled={mutation.isPending}
          aria-label={t("ai.executive.regenerate")}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", mutation.isPending && "animate-spin")}
            aria-hidden
          />
        </Button>
      </CardHeader>
      <CardContent>
        {mutation.isPending && !data && <SkeletonLines count={4} />}
        {mutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex-1">
              <p>{translateApiError(mutation.error as ApiError, t)}</p>
              <button
                type="button"
                onClick={trigger}
                className="mt-1 font-medium underline-offset-2 hover:underline"
              >
                {t("common.retry")}
              </button>
            </div>
          </div>
        )}
        {!mutation.isPending && !mutation.isError && data && (
          <>
            {data.anomalies.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {t("ai.executive.empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {data.anomalies.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-sm"
                  >
                    <SeverityDot severity={a.severity} />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-foreground"
                        dir={language === "ar" ? "rtl" : "ltr"}
                      >
                        {a.insight}
                      </p>
                      {a.drillDownFilter && (
                        <p
                          className="mt-1 font-mono text-[10px] text-muted-foreground"
                          dir="ltr"
                        >
                          {a.drillDownFilter}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t("ai.executive.generatedAt")}: {formatDateTime(data.generatedAt)}
            </p>
          </>
        )}
        {!mutation.isPending && !data && !mutation.isError && (
          <p className="py-3 text-center text-xs text-muted-foreground">
            {t("ai.executive.notRunYet")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SeverityDot({
  severity,
}: {
  severity: "info" | "warning" | "critical";
}) {
  const styles =
    severity === "critical"
      ? "bg-destructive"
      : severity === "warning"
        ? "bg-amber-500"
        : "bg-muted-foreground";
  return (
    <span
      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", styles)}
      aria-hidden
    />
  );
}

function SkeletonLines({ count }: { count: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}
