/**
 * ContractAIInsightsPanel — inline AI insights card rendered below the
 * tabbed content on the contract detail page (matches Lovable hosted layout).
 *
 * Five prompt tabs:
 *   - Summary       — streaming via useAiInsightsSseStream (mode='summary')
 *   - Key terms     — non-streaming useAiContractInsights (mode='key_terms')
 *   - Risk flags    — mode='risks'
 *   - Obligations   — mode='obligations'
 *   - Regulatory    — mode='regulatory'
 *
 * Each tab fires on first selection (lazy) and caches the result in
 * component state. Copy + Regenerate live in the footer per Lovable.
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Sparkles,
  Copy,
  RotateCcw,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAiContractInsights } from "@/features/ai/hooks/useAi";
import { useAiInsightsSseStream } from "@/features/ai/hooks/useAiInsightsSseStream";
import { aiService } from "@/services/api/ai.service";
import { translateApiError } from "@/lib/translate-api-error";
import { cn } from "@/lib/utils";
import type {
  AiContractInsightsRequest,
  AiContractKeyTermsPayload,
  AiContractRisksPayload,
  AiContractObligationsPayload,
  AiContractRegulatoryPayload,
} from "@/types/entities/ai.types";

type InsightsTab = "summary" | "key_terms" | "risks" | "obligations" | "regulatory";

interface ContractAIInsightsPanelProps {
  contractId: number;
}

interface TabResult {
  payload?:
    | AiContractKeyTermsPayload
    | AiContractRisksPayload
    | AiContractObligationsPayload
    | AiContractRegulatoryPayload;
  summaryText?: string;
  isLoading: boolean;
  error?: string;
}

const TAB_ORDER: InsightsTab[] = ["summary", "key_terms", "risks", "obligations", "regulatory"];

const TAB_TO_MODE: Record<Exclude<InsightsTab, "summary">, AiContractInsightsRequest["mode"]> = {
  key_terms: "key_terms",
  risks: "risks",
  obligations: "obligations",
  regulatory: "regulatory",
};

export function ContractAIInsightsPanel({ contractId }: ContractAIInsightsPanelProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language?.startsWith("ar") ? "ar" : "en";
  const [activeTab, setActiveTab] = useState<InsightsTab>("summary");
  const [results, setResults] = useState<Record<InsightsTab, TabResult>>({
    summary: { isLoading: false },
    key_terms: { isLoading: false },
    risks: { isLoading: false },
    obligations: { isLoading: false },
    regulatory: { isLoading: false },
  });

  const insights = useAiContractInsights();

  const setTabResult = useCallback((tab: InsightsTab, patch: Partial<TabResult>) => {
    setResults((r) => ({ ...r, [tab]: { ...r[tab], ...patch } }));
  }, []);

  const summaryStream = useAiInsightsSseStream({
    onToken: (delta) => {
      setResults((r) => ({
        ...r,
        summary: {
          ...r.summary,
          summaryText: (r.summary.summaryText ?? "") + delta,
          isLoading: true,
        },
      }));
    },
    onDone: () => setTabResult("summary", { isLoading: false }),
    onError: (err) => setTabResult("summary", { isLoading: false, error: err.message ?? err.code }),
  });

  const runTab = useCallback(
    async (tab: InsightsTab) => {
      if (tab === "summary") {
        setTabResult("summary", { summaryText: "", isLoading: true, error: undefined });
        await summaryStream.start({ contractId, mode: "summary", language });
        return;
      }
      const mode = TAB_TO_MODE[tab];
      setTabResult(tab, { isLoading: true, error: undefined, payload: undefined });
      insights.mutate(
        { contractId, mode, language },
        {
          onSuccess: (resp) => {
            if (
              resp.mode === "key_terms" ||
              resp.mode === "risks" ||
              resp.mode === "obligations" ||
              resp.mode === "regulatory"
            ) {
              setTabResult(tab, { isLoading: false, payload: resp.payload });
            } else {
              setTabResult(tab, {
                isLoading: false,
                error: t("ai.insights.unexpectedShape", {
                  defaultValue: "Unexpected response shape",
                }),
              });
            }
          },
          onError: (err) => {
            setTabResult(tab, { isLoading: false, error: translateApiError(err, t) });
          },
        },
      );
    },
    [contractId, language, summaryStream, insights, setTabResult, t],
  );

  // Auto-fire ALL 5 tabs in parallel on first mount so every tab is ready
  // by the time the user scrolls down. Summary uses SSE (its own hook); the
  // other 4 bypass the shared useMutation (which would serialise them) and
  // call aiService directly via Promise.all so requests fire concurrently.
  useEffect(() => {
    void runTab("summary");
    const parallelTabs: Exclude<InsightsTab, "summary">[] = [
      "key_terms",
      "risks",
      "obligations",
      "regulatory",
    ];
    parallelTabs.forEach((tab) =>
      setTabResult(tab, { isLoading: true, error: undefined, payload: undefined }),
    );
    void Promise.all(
      parallelTabs.map(async (tab) => {
        try {
          const resp = await aiService.contractInsights({
            contractId,
            mode: TAB_TO_MODE[tab],
            language,
          });
          if (
            resp.mode === "key_terms" ||
            resp.mode === "risks" ||
            resp.mode === "obligations" ||
            resp.mode === "regulatory"
          ) {
            setTabResult(tab, { isLoading: false, payload: resp.payload });
          } else {
            setTabResult(tab, {
              isLoading: false,
              error: t("ai.insights.unexpectedShape", {
                defaultValue: "Unexpected response shape",
              }),
            });
          }
        } catch (err) {
          setTabResult(tab, {
            isLoading: false,
            error: translateApiError(err as Parameters<typeof translateApiError>[0], t),
          });
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const handleSelectTab = useCallback(
    (tab: InsightsTab) => {
      setActiveTab(tab);
      const r = results[tab];
      const hasResult = tab === "summary" ? !!r.summaryText : !!r.payload;
      if (!hasResult && !r.isLoading) void runTab(tab);
    },
    [results, runTab],
  );

  const handleCopy = useCallback(async () => {
    const r = results[activeTab];
    let text = "";
    if (activeTab === "summary") text = r.summaryText ?? "";
    else if (r.payload) text = JSON.stringify(r.payload, null, 2);
    if (!text) {
      toast.error(t("ai.insights.nothingToCopy", { defaultValue: "Nothing to copy yet." }));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("ai.insights.copied", { defaultValue: "Copied to clipboard" }));
    } catch {
      toast.error(t("ai.insights.copyFailed", { defaultValue: "Copy failed" }));
    }
  }, [activeTab, results, t]);

  const handleRegenerate = useCallback(() => void runTab(activeTab), [activeTab, runTab]);

  const tabLabels: Record<InsightsTab, string> = useMemo(
    () => ({
      summary: t("ai.insights.tabs.summary", { defaultValue: "Summary" }),
      key_terms: t("ai.insights.tabs.keyTerms", { defaultValue: "Key terms" }),
      risks: t("ai.insights.tabs.risks", { defaultValue: "Risk flags" }),
      obligations: t("ai.insights.tabs.obligations", { defaultValue: "Obligations" }),
      regulatory: t("ai.insights.tabs.regulatory", { defaultValue: "Regulatory" }),
    }),
    [t],
  );

  const active = results[activeTab];

  return (
    <Card className="overflow-hidden">
      <header className="flex items-center gap-2 border-b border-border/60 bg-card/50 px-5 py-3">
        <div className="rounded-full bg-gold/10 p-1.5">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
        </div>
        <h2 className="text-base font-semibold text-ink">
          {t("ai.insights.title", { defaultValue: "AI insights" })}
        </h2>
      </header>

      <div role="tablist" className="flex flex-wrap gap-1 px-5 pt-4">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => handleSelectTab(tab)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              activeTab === tab
                ? "bg-ink text-card font-medium"
                : "bg-surface text-ink-muted hover:bg-muted",
            )}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div className="px-5 py-4">
        {active.isLoading && !active.summaryText && !active.payload ? (
          <div
            className="flex flex-col items-center justify-center py-10 text-xs text-ink-muted"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
            <p className="mt-2">{t("ai.insights.loading", { defaultValue: "Asking the model…" })}</p>
          </div>
        ) : active.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {active.error}
          </div>
        ) : (
          <>
            {activeTab === "summary" && (
              <SummaryPanel text={active.summaryText} isStreaming={active.isLoading} />
            )}
            {activeTab === "key_terms" && (
              <KeyTermsPanel payload={active.payload as AiContractKeyTermsPayload | undefined} />
            )}
            {activeTab === "risks" && (
              <RisksPanel payload={active.payload as AiContractRisksPayload | undefined} />
            )}
            {activeTab === "obligations" && (
              <ObligationsPanel payload={active.payload as AiContractObligationsPayload | undefined} />
            )}
            {activeTab === "regulatory" && (
              <RegulatoryPanel payload={active.payload as AiContractRegulatoryPayload | undefined} />
            )}
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border/60 bg-card/30 px-5 py-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
          <Sparkles className="h-3 w-3 text-gold" aria-hidden />
          {t("ai.insights.poweredBy", { defaultValue: "Generated with AI" })}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            aria-label={t("ai.insights.copy", { defaultValue: "Copy" })}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleRegenerate}
            disabled={active.isLoading}
            aria-label={t("ai.insights.regenerate", { defaultValue: "Regenerate" })}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </footer>
    </Card>
  );
}

// ── Per-tab panels ──────────────────────────────────────────────────────────

function SummaryPanel({ text, isStreaming }: { text?: string; isStreaming: boolean }) {
  const { t } = useTranslation();
  if (!text) {
    return (
      <p className="text-xs text-ink-subtle">
        {t("ai.insights.summary.empty", { defaultValue: "No summary generated yet." })}
      </p>
    );
  }
  return (
    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-ink">
      {text}
      {isStreaming && <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-gold" aria-hidden />}
    </div>
  );
}

function KeyTermsPanel({ payload }: { payload?: AiContractKeyTermsPayload }) {
  const { t } = useTranslation();
  if (!payload) return <EmptyHint kind="key_terms" />;
  if (payload.keyTerms.length === 0) {
    return (
      <p className="text-xs text-ink-subtle">
        {t("ai.insights.keyTerms.empty", { defaultValue: "No key terms identified." })}
      </p>
    );
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {payload.keyTerms.map((kt, i) => (
        <div key={i} className="rounded-md border border-border bg-surface p-3">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
            {kt.label}
          </dt>
          <dd className="mt-1 text-sm text-ink">{kt.value}</dd>
          {kt.clauseAnchor && (
            <p className="mt-1 font-mono text-[10px] text-ink-subtle">{kt.clauseAnchor}</p>
          )}
          {kt.clauseExcerpt && (
            <p className="mt-1 text-[11px] italic text-ink-muted">{kt.clauseExcerpt}</p>
          )}
        </div>
      ))}
    </dl>
  );
}

const SEVERITY_TINT: Record<"high" | "medium" | "low", string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-amber-tint/40 text-amber-ink border-amber-300/40",
  low: "bg-surface text-ink-muted border-border",
};

function RisksPanel({ payload }: { payload?: AiContractRisksPayload }) {
  const { t } = useTranslation();
  if (!payload) return <EmptyHint kind="risks" />;
  if (payload.risks.length === 0) {
    return (
      <p className="text-xs text-ink-subtle">
        {t("ai.insights.risks.empty", { defaultValue: "No risk flags raised." })}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {payload.risks.map((risk, i) => (
        <li
          key={i}
          className={cn(
            "rounded-md border p-3",
            SEVERITY_TINT[risk.severity] ?? "bg-surface text-ink-muted border-border",
          )}
        >
          <div className="flex items-center gap-2">
            {risk.severity === "high" && <AlertTriangle className="h-3.5 w-3.5" />}
            {risk.severity === "medium" && <AlertCircle className="h-3.5 w-3.5" />}
            {risk.severity === "low" && <CheckCircle2 className="h-3.5 w-3.5" />}
            <span className="text-xs font-medium">{risk.title}</span>
            <span className="ms-auto rounded-full bg-card/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
              {risk.severity}
            </span>
          </div>
          <p className="mt-2 text-xs">{risk.rationale}</p>
          {risk.clauseAnchor && (
            <p className="mt-1 font-mono text-[10px] opacity-70">{risk.clauseAnchor}</p>
          )}
          {risk.clauseExcerpt && (
            <p className="mt-1 text-[11px] italic opacity-80">{risk.clauseExcerpt}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function ObligationsPanel({ payload }: { payload?: AiContractObligationsPayload }) {
  const { t } = useTranslation();
  if (!payload) return <EmptyHint kind="obligations" />;
  if (payload.obligations.length === 0) {
    return (
      <p className="text-xs text-ink-subtle">
        {t("ai.insights.obligations.empty", { defaultValue: "No obligations extracted." })}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {payload.obligations.map((ob, i) => (
        <li key={i} className="rounded-md border border-border bg-surface p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {ob.party}
            </span>
            {ob.deadline && (
              <span className="font-mono text-[10px] text-ink-subtle">{ob.deadline}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink">{ob.obligation}</p>
          {ob.clauseAnchor && (
            <p className="mt-1 font-mono text-[10px] text-ink-subtle">{ob.clauseAnchor}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function RegulatoryPanel({ payload }: { payload?: AiContractRegulatoryPayload }) {
  const { t } = useTranslation();
  if (!payload) return <EmptyHint kind="regulatory" />;
  if (payload.regulations.length === 0) {
    return (
      <p className="text-xs text-ink-subtle">
        {t("ai.insights.regulatory.empty", { defaultValue: "No regulatory references." })}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {payload.regulations.map((reg, i) => (
        <li key={i} className="rounded-md border border-border bg-surface p-3">
          <p className="text-sm font-medium text-ink">{reg.citation}</p>
          <p className="mt-1 text-xs text-ink-muted">{reg.relevance}</p>
          {reg.clauseAnchor && (
            <p className="mt-1 font-mono text-[10px] text-ink-subtle">{reg.clauseAnchor}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function EmptyHint({ kind }: { kind: InsightsTab }) {
  const { t } = useTranslation();
  return (
    <p className="text-xs text-ink-subtle">
      {t(`ai.insights.${kind}.placeholder`, {
        defaultValue: "Click the tab to generate.",
      })}
    </p>
  );
}
