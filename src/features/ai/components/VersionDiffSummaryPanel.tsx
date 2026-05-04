/**
 * VersionDiffSummaryPanel (M4 — S6).
 *
 * Mode: REGENERATE — section that slots into the existing Lovable
 * VersionCompareDialog (470 lines). The Lovable component used
 * supabase.functions.invoke('ai-version-diff-summary') with a different
 * payload shape; per memory feedback_regenerate_when_lovable_too_coupled.md,
 * regenerate cleanly. The wider VersionCompareDialog modal is out of M4
 * scope (it's contract-versioning UX from M1a) — this is the panel that
 * the dialog can mount inside its existing structure when ready.
 *
 * Behaviour:
 *   - Caller passes the precomputed diff (additions / deletions /
 *     modifiedClauses) — same shape M3's signer-Q&A produces.
 *   - Mutation triggers POST /api/v1/ai/version-diff-summary which:
 *       * caches via ai_insight (7d TTL)
 *       * persists summary to contract_version.diff_summary on success
 *   - Render summary in the appropriate language with RTL handling.
 *
 * SECURITY:
 *   - additions / deletions / modifiedClauses are SENSITIVE — flow
 *     through fetch body only; never console-logged.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAiVersionDiffSummary } from "@/features/ai/hooks/useAi";
import type {
  AiLanguage,
  AiVersionDiffSummaryRequest,
} from "@/types/entities/ai.types";

interface Props {
  contractId: number;
  leftVersionId: number;
  rightVersionId: number;
  /** SENSITIVE. */
  additions: string;
  /** SENSITIVE. */
  deletions: string;
  /** SENSITIVE — clause names + before/after. */
  modifiedClauses: AiVersionDiffSummaryRequest["modifiedClauses"];
  language: AiLanguage;
  autoFetch?: boolean;
}

export function VersionDiffSummaryPanel(props: Props) {
  const { t } = useTranslation();
  const mutation = useAiVersionDiffSummary();

  const trigger = () => {
    mutation.mutate({
      contractId: props.contractId,
      leftVersionId: props.leftVersionId,
      rightVersionId: props.rightVersionId,
      additions: props.additions,
      deletions: props.deletions,
      modifiedClauses: props.modifiedClauses,
      language: props.language,
    });
  };

  useEffect(() => {
    if (props.autoFetch !== false) trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.contractId,
    props.leftVersionId,
    props.rightVersionId,
    props.language,
  ]);

  const data = mutation.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          {t("ai.versionDiff.title")}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={trigger}
          disabled={mutation.isPending}
          aria-label={t("ai.versionDiff.regenerate")}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", mutation.isPending && "animate-spin")}
            aria-hidden
          />
        </Button>
      </CardHeader>
      <CardContent>
        {mutation.isPending && !data && (
          <div className="space-y-2" aria-busy="true">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-3 w-10/12 animate-pulse rounded bg-muted" />
          </div>
        )}
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
            <p
              className="whitespace-pre-line text-sm leading-relaxed text-foreground"
              dir={props.language === "ar" ? "rtl" : "ltr"}
            >
              {data.summary}
            </p>
            {data.cacheHit && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("ai.versionDiff.cacheHit")}
              </p>
            )}
          </>
        )}
        {!mutation.isPending && !data && !mutation.isError && (
          <p className="py-3 text-center text-xs text-muted-foreground">
            {t("ai.versionDiff.notRunYet")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
