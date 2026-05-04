/**
 * AIInsightsSidebar (M4 — S1).
 *
 * Mode: REGENERATE (Lovable component was 1618 lines, deeply coupled to
 * supabase.functions.invoke and to non-existent regulatory_impacts /
 * regulations / obligations tables, plus hard-coded demo bilingual data).
 * Per memory feedback_regenerate_when_lovable_too_coupled.md, regenerate
 * cleanly. M2 had 4/8 regenerated; M3 had 5/12.
 *
 * Visual lineage retained:
 *   - 5-tab pill bar (summary, key_terms, risks, obligations, regulatory)
 *   - Inline streaming cursor for the streaming modes
 *   - Tab content cards (StatusBadge severity for risks, etc.)
 *   - Sparkles header when not embedded
 *
 * Streaming behaviour:
 *   - mode='summary' uses useAiInsightsSseStream (fetch + ReadableStream).
 *   - mode='key_terms'|'risks'|'obligations'|'regulatory' uses the
 *     synchronous mutation (useAiContractInsights). The BE caches via
 *     ai_insight (24h TTL) so re-tab clicks are cheap.
 *
 * Accessibility:
 *   - aria-pressed on tab pills (T6).
 *   - role="alert" on error blocks.
 *   - dir attribute keyed off props.locale for RTL of AI-rendered text.
 *
 * Data states (T4):
 *   - Loading: Card skeleton (matches list height).
 *   - Empty: localised "no items" message + retry CTA.
 *   - Error: inline error card + retry CTA.
 *
 * SECURITY (T13):
 *   - selectedText (rewrite mode) flows through fetch body only — never logged.
 *   - Streamed AI output is held in component state only; not persisted.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  useAiContractInsights,
} from "@/features/ai/hooks/useAi";
import { useAiInsightsSseStream } from "@/features/ai/hooks/useAiInsightsSseStream";
import type {
  AiContractInsightsMode,
  AiContractKeyTermsPayload,
  AiContractObligationsPayload,
  AiContractRegulatoryPayload,
  AiContractRisksPayload,
  AiLanguage,
} from "@/types/entities/ai.types";

type TabKey = AiContractInsightsMode;

const TABS: ReadonlyArray<{ key: TabKey; labelKey: string }> = [
  { key: "summary", labelKey: "ai.insights.tabs.summary" },
  { key: "key_terms", labelKey: "ai.insights.tabs.keyTerms" },
  { key: "risks", labelKey: "ai.insights.tabs.risks" },
  { key: "obligations", labelKey: "ai.insights.tabs.obligations" },
  { key: "regulatory", labelKey: "ai.insights.tabs.regulatory" },
];

interface Props {
  contractId: number;
  /** Display locale — drives dir/RTL on AI-rendered text. */
  locale: AiLanguage;
  /** When true, hide the outer card chrome (caller owns the surface). */
  embedded?: boolean;
}

export function AIInsightsSidebar({ contractId, locale, embedded }: Props) {
  const { t } = useTranslation();
  const [active, setActive] = useState<TabKey>("summary");

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        !embedded && "rounded-xl border border-border bg-card p-4 shadow-sm",
      )}
    >
      {!embedded && (
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold text-foreground">
            {t("ai.insights.title")}
          </h2>
        </div>
      )}

      <div
        role="tablist"
        aria-label={t("ai.insights.tabsAriaLabel") ?? "AI insights tabs"}
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            onClick={() => setActive(tab.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              active === tab.key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
            aria-selected={active === tab.key}
            aria-pressed={active === tab.key}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="min-h-[160px]" role="tabpanel" aria-live="polite">
        {active === "summary" && (
          <SummaryTab contractId={contractId} language={locale} />
        )}
        {active === "key_terms" && (
          <KeyTermsTab contractId={contractId} language={locale} />
        )}
        {active === "risks" && (
          <RisksTab contractId={contractId} language={locale} />
        )}
        {active === "obligations" && (
          <ObligationsTab contractId={contractId} language={locale} />
        )}
        {active === "regulatory" && (
          <RegulatoryTab contractId={contractId} language={locale} />
        )}
      </div>
    </div>
  );
}

// ─── SummaryTab — streams via SSE ────────────────────────────────────────────

function SummaryTab({
  contractId,
  language,
}: {
  contractId: number;
  language: AiLanguage;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { isStreaming, start } = useAiInsightsSseStream({
    onToken: (delta) => setText((p) => p + delta),
    onDone: () => {
      // tokens metadata is informational; nothing else to do here.
    },
    onError: (err) =>
      setError(
        err.message ?? t("ai.errors.streamFailed", { defaultValue: "Streaming failed" }),
      ),
  });

  const triggerStream = () => {
    setText("");
    setError(null);
    void start({ contractId, mode: "summary", language });
  };

  useEffect(() => {
    triggerStream();
    // Re-trigger when contract or language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, language]);

  if (error) {
    return (
      <ErrorCard message={error} onRetry={triggerStream} />
    );
  }

  if (isStreaming && text.length === 0) {
    return <SkeletonLines count={4} />;
  }

  if (!isStreaming && text.length === 0) {
    return (
      <EmptyState
        message={t("ai.insights.summary.empty")}
        onRetry={triggerStream}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p
        className="whitespace-pre-line text-sm leading-relaxed text-foreground"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        {text}
        {isStreaming && (
          <span
            className="ms-0.5 inline-block h-4 w-[2px] -translate-y-[1px] bg-primary align-middle"
            aria-hidden
          />
        )}
      </p>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" aria-hidden />
          {t("ai.insights.disclaimer")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={triggerStream}
          disabled={isStreaming}
          aria-label={t("ai.insights.regenerate") ?? "Regenerate"}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isStreaming && "animate-spin")}
            aria-hidden
          />
        </Button>
      </div>
    </div>
  );
}

// ─── KeyTermsTab — non-streaming (mutation) ─────────────────────────────────

function KeyTermsTab({
  contractId,
  language,
}: {
  contractId: number;
  language: AiLanguage;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<AiContractKeyTermsPayload | null>(null);
  const mutation = useAiContractInsights();

  const trigger = () => {
    mutation.mutate(
      { contractId, mode: "key_terms", language },
      {
        onSuccess: (resp) => {
          if (resp.mode === "key_terms") setData(resp.payload);
        },
      },
    );
  };

  useEffect(() => {
    trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, language]);

  if (mutation.isPending && !data) return <SkeletonLines count={5} />;
  if (mutation.isError) {
    return (
      <ErrorCard
        message={translateApiError(mutation.error as ApiError, t)}
        onRetry={trigger}
      />
    );
  }
  const items = data?.keyTerms ?? [];
  if (items.length === 0) {
    return <EmptyState message={t("ai.insights.keyTerms.empty")} onRetry={trigger} />;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((term, i) => (
        <li
          key={`${term.label}-${i}`}
          className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm"
        >
          <span className="text-muted-foreground">{term.label}</span>
          <span
            className="text-end text-foreground"
            dir={language === "ar" ? "rtl" : "ltr"}
            title={term.clauseExcerpt ?? undefined}
          >
            {term.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── RisksTab ────────────────────────────────────────────────────────────────

function RisksTab({
  contractId,
  language,
}: {
  contractId: number;
  language: AiLanguage;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<AiContractRisksPayload | null>(null);
  const mutation = useAiContractInsights();

  const trigger = () => {
    mutation.mutate(
      { contractId, mode: "risks", language },
      {
        onSuccess: (resp) => {
          if (resp.mode === "risks") setData(resp.payload);
        },
      },
    );
  };

  useEffect(() => {
    trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, language]);

  if (mutation.isPending && !data) return <SkeletonLines count={3} height="h-20" />;
  if (mutation.isError) {
    return (
      <ErrorCard
        message={translateApiError(mutation.error as ApiError, t)}
        onRetry={trigger}
      />
    );
  }
  const items = data?.risks ?? [];
  if (items.length === 0) {
    return <EmptyState message={t("ai.insights.risks.empty")} onRetry={trigger} />;
  }
  return (
    <ul className="space-y-2.5">
      {items.map((risk, i) => (
        <li
          key={`${risk.title}-${i}`}
          className="rounded-md border border-border bg-card p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className="text-sm font-medium text-foreground"
                dir={language === "ar" ? "rtl" : "ltr"}
              >
                {risk.title}
              </p>
              <p
                className="mt-0.5 text-xs text-muted-foreground"
                dir={language === "ar" ? "rtl" : "ltr"}
              >
                {risk.rationale}
              </p>
              {risk.clauseExcerpt && (
                <p
                  className="mt-1.5 rounded-md border border-border/60 bg-muted/40 p-2 text-xs italic text-muted-foreground"
                  dir={language === "ar" ? "rtl" : "ltr"}
                >
                  {risk.clauseExcerpt}
                </p>
              )}
            </div>
            <SeverityBadge severity={risk.severity} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── ObligationsTab ──────────────────────────────────────────────────────────

function ObligationsTab({
  contractId,
  language,
}: {
  contractId: number;
  language: AiLanguage;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<AiContractObligationsPayload | null>(null);
  const mutation = useAiContractInsights();

  const trigger = () => {
    mutation.mutate(
      { contractId, mode: "obligations", language },
      {
        onSuccess: (resp) => {
          if (resp.mode === "obligations") setData(resp.payload);
        },
      },
    );
  };

  useEffect(() => {
    trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, language]);

  if (mutation.isPending && !data) return <SkeletonLines count={3} />;
  if (mutation.isError) {
    return (
      <ErrorCard
        message={translateApiError(mutation.error as ApiError, t)}
        onRetry={trigger}
      />
    );
  }
  const items = data?.obligations ?? [];
  if (items.length === 0) {
    return (
      <EmptyState message={t("ai.insights.obligations.empty")} onRetry={trigger} />
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((o, i) => (
        <li
          key={`${o.party}-${i}`}
          className="rounded-md border border-border bg-card p-3 text-sm"
        >
          <p
            className="font-medium text-foreground"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {o.obligation}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{o.party}</span>
            {o.deadline && (
              <span>
                {t("ai.insights.obligations.deadlineLabel")}: {o.deadline}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── RegulatoryTab ───────────────────────────────────────────────────────────

function RegulatoryTab({
  contractId,
  language,
}: {
  contractId: number;
  language: AiLanguage;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<AiContractRegulatoryPayload | null>(null);
  const mutation = useAiContractInsights();

  const trigger = () => {
    mutation.mutate(
      { contractId, mode: "regulatory", language },
      {
        onSuccess: (resp) => {
          if (resp.mode === "regulatory") setData(resp.payload);
        },
      },
    );
  };

  useEffect(() => {
    trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, language]);

  if (mutation.isPending && !data) return <SkeletonLines count={3} />;
  if (mutation.isError) {
    return (
      <ErrorCard
        message={translateApiError(mutation.error as ApiError, t)}
        onRetry={trigger}
      />
    );
  }
  const items = data?.regulations ?? [];
  if (items.length === 0) {
    return (
      <EmptyState message={t("ai.insights.regulatory.empty")} onRetry={trigger} />
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((r, i) => (
        <li
          key={`${r.citation}-${i}`}
          className="rounded-md border border-border bg-card p-3 text-sm"
        >
          <p
            className="font-medium text-foreground"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {r.citation}
          </p>
          <p
            className="mt-1 text-xs text-muted-foreground"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {r.relevance}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function SkeletonLines({
  count,
  height = "h-3",
}: {
  count: number;
  height?: string;
}) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn("animate-pulse rounded bg-muted", height, "w-full")}
        />
      ))}
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card role="alert" className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex items-start gap-2 p-3 text-xs text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex-1">
          <p>{message}</p>
          <button
            onClick={onRetry}
            className="mt-1 font-medium underline-offset-2 hover:underline"
          >
            {t("common.retry")}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="me-1 h-3 w-3" aria-hidden />
        {t("common.retry")}
      </Button>
    </div>
  );
}

function SeverityBadge({
  severity,
}: {
  severity: "high" | "medium" | "low";
}) {
  const { t } = useTranslation();
  const styles =
    severity === "high"
      ? "bg-destructive/10 text-destructive"
      : severity === "medium"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        styles,
      )}
    >
      {t(`ai.insights.severity.${severity}`)}
    </span>
  );
}
