/**
 * AIDraftingPanel (M4 — S2).
 *
 * Mode: REGENERATE (Lovable component was 938 lines, calls
 * supabase.functions.invoke with custom OpenAI SSE shape — incompatible
 * with the v2.6 BE wire format which uses {type,delta} chunks). Per
 * memory feedback_regenerate_when_lovable_too_coupled.md, regenerate.
 *
 * Visual lineage retained:
 *   - Mode pill bar (chat | suggest | explain | rewrite)
 *   - Chat transcript with streaming cursor
 *   - Suggest results panel (4 cards max)
 *
 * Streaming behaviour:
 *   - mode='chat'|'explain'|'rewrite' uses useAiDraftingSseStream.
 *   - mode='suggest' uses useAiDraftingAssistantSuggest (mutation).
 *
 * Conversation history (Q4 ephemeral) — kept in component state only,
 * NEVER persisted, NEVER logged. The BE's chat mode requires the last
 * 20 turns capped at 4000 chars each.
 *
 * SECURITY (T13):
 *   - chatHistory + selectedText + draftSummary are SENSITIVE — flow
 *     through fetch body only; never console-logged.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Send, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translateApiError } from "@/lib/translate-api-error";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAiDraftingAssistantSuggest } from "@/features/ai/hooks/useAi";
import { useAiDraftingSseStream } from "@/features/ai/hooks/useAiDraftingSseStream";
import type {
  AiDraftingAssistantChatTurn,
  AiDraftingAssistantMode,
  AiDraftingAssistantTone,
  AiLanguage,
} from "@/types/entities/ai.types";

const MODES: ReadonlyArray<{ key: AiDraftingAssistantMode; labelKey: string }> = [
  { key: "chat", labelKey: "ai.drafting.modes.chat" },
  { key: "suggest", labelKey: "ai.drafting.modes.suggest" },
  { key: "explain", labelKey: "ai.drafting.modes.explain" },
  { key: "rewrite", labelKey: "ai.drafting.modes.rewrite" },
];

const TONES: ReadonlyArray<AiDraftingAssistantTone> = [
  "simpler",
  "formal",
  "stronger",
  "balanced",
];

const MAX_HISTORY_TURNS = 20;
const MAX_TURN_CHARS = 4000;

interface Props {
  /** Contract type, e.g. 'employment', 'service'. Required by BE. */
  contractType: string;
  /** Our-party display name. Required by BE. */
  partyA: string;
  /** Counterparty display name. */
  partyB?: string;
  /** Short summary of the draft so far (sent verbatim — SENSITIVE). */
  draftSummary: string;
  /** Existing clause categories (e.g. ['confidentiality','termination']). */
  existingClauseCategories: string[];
  /** Language to render AI output in. */
  language: AiLanguage;
  /** Optional preselected text (when caller passes a clause to explain/rewrite). */
  initialSelectedText?: string;
}

export function AIDraftingPanel(props: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AiDraftingAssistantMode>("chat");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <header className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-foreground">
          {t("ai.drafting.title")}
        </h2>
      </header>

      <div
        role="tablist"
        aria-label={t("ai.drafting.modesAriaLabel") ?? "Drafting modes"}
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            onClick={() => setMode(m.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              mode === m.key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
            aria-selected={mode === m.key}
            aria-pressed={mode === m.key}
          >
            {t(m.labelKey)}
          </button>
        ))}
      </div>

      {mode === "chat" && <ChatPanel {...props} />}
      {mode === "suggest" && <SuggestPanel {...props} />}
      {(mode === "explain" || mode === "rewrite") && (
        <SelectedTextPanel mode={mode} {...props} />
      )}
    </div>
  );
}

// ─── ChatPanel ──────────────────────────────────────────────────────────────

function ChatPanel(props: Props) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<AiDraftingAssistantChatTurn[]>([]);
  const [pendingAssistant, setPendingAssistant] = useState("");
  const [input, setInput] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);

  const { isStreaming, start, abort } = useAiDraftingSseStream({
    onToken: (delta) => setPendingAssistant((p) => p + delta),
    onDone: () => {
      setPendingAssistant((current) => {
        if (current.length > 0) {
          setHistory((h) => {
            const assistantTurn: AiDraftingAssistantChatTurn = {
              role: "assistant",
              content: current.slice(0, MAX_TURN_CHARS),
            };
            return [...h, assistantTurn].slice(-MAX_HISTORY_TURNS);
          });
        }
        return "";
      });
    },
    onError: (err) => {
      if (err.code === "RATE_LIMITED" && err.retryAfterSeconds) {
        toast.error(
          t("ai.errors.rateLimitedRetryIn", {
            seconds: err.retryAfterSeconds,
            defaultValue: `Rate limited. Retry in ${err.retryAfterSeconds}s.`,
          }),
        );
      } else {
        toast.error(
          err.message ??
            t("ai.errors.streamFailed", { defaultValue: "Streaming failed" }),
        );
      }
      setPendingAssistant("");
    },
  });

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [history, pendingAssistant]);

  const onSend = () => {
    const trimmed = input.trim();
    if (trimmed.length === 0 || isStreaming) return;
    const userTurn: AiDraftingAssistantChatTurn = {
      role: "user",
      content: trimmed.slice(0, MAX_TURN_CHARS),
    };
    const nextHistory = [...history, userTurn].slice(-MAX_HISTORY_TURNS);
    setHistory(nextHistory);
    setInput("");
    setPendingAssistant("");
    void start({
      mode: "chat",
      contractType: props.contractType,
      partyA: props.partyA,
      partyB: props.partyB,
      draftSummary: props.draftSummary,
      existingClauseCategories: props.existingClauseCategories,
      language: props.language,
      chatHistory: nextHistory,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={transcriptRef}
        className="max-h-72 min-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 p-3"
        aria-live="polite"
      >
        {history.length === 0 && pendingAssistant.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("ai.drafting.chat.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((turn, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm",
                  turn.role === "user"
                    ? "bg-primary/10 text-foreground"
                    : "bg-card text-foreground",
                )}
                dir={props.language === "ar" ? "rtl" : "ltr"}
              >
                {turn.content}
              </li>
            ))}
            {pendingAssistant.length > 0 && (
              <li
                className="rounded-md bg-card px-2.5 py-1.5 text-sm"
                dir={props.language === "ar" ? "rtl" : "ltr"}
              >
                {pendingAssistant}
                <span
                  className="ms-0.5 inline-block h-4 w-[2px] -translate-y-[1px] bg-primary align-middle"
                  aria-hidden
                />
              </li>
            )}
          </ul>
        )}
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="flex items-center gap-2"
      >
        <label className="sr-only" htmlFor="ai-drafting-chat-input">
          {t("ai.drafting.chat.inputLabel")}
        </label>
        <input
          id="ai-drafting-chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_TURN_CHARS}
          placeholder={t("ai.drafting.chat.placeholder")}
          dir={props.language === "ar" ? "rtl" : "ltr"}
          disabled={isStreaming}
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {isStreaming ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => abort()}
            aria-label={t("ai.drafting.chat.stop")}
          >
            <Square className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            disabled={input.trim().length === 0}
            aria-label={t("ai.drafting.chat.send")}
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </form>
    </div>
  );
}

// ─── SuggestPanel ───────────────────────────────────────────────────────────

function SuggestPanel(props: Props) {
  const { t } = useTranslation();
  const mutation = useAiDraftingAssistantSuggest();

  const trigger = () => {
    mutation.mutate({
      mode: "suggest",
      contractType: props.contractType,
      partyA: props.partyA,
      partyB: props.partyB,
      draftSummary: props.draftSummary,
      existingClauseCategories: props.existingClauseCategories,
      language: props.language,
    });
  };

  const data = mutation.data?.suggestions ?? [];

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={trigger} disabled={mutation.isPending} size="sm">
        <Sparkles className="me-1 h-3.5 w-3.5" aria-hidden />
        {mutation.isPending
          ? t("ai.drafting.suggest.loading")
          : t("ai.drafting.suggest.run")}
      </Button>
      {mutation.isPending && <SkeletonLines count={3} height="h-12" />}
      {mutation.isError && (
        <ErrorCard
          message={translateApiError(mutation.error as ApiError, t)}
          onRetry={trigger}
        />
      )}
      {!mutation.isPending && data.length === 0 && mutation.isSuccess && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          {t("ai.drafting.suggest.empty")}
        </p>
      )}
      <ul className="space-y-2">
        {data.map((s, i) => (
          <li
            key={`${s.title}-${i}`}
            className="rounded-md border border-border bg-card p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                {t(`ai.drafting.suggest.kind.${s.kind}`, {
                  defaultValue: s.kind,
                })}
              </span>
            </div>
            <p
              className="mt-1 font-medium text-foreground"
              dir={props.language === "ar" ? "rtl" : "ltr"}
            >
              {s.title}
            </p>
            <p
              className="mt-1 text-xs text-muted-foreground"
              dir={props.language === "ar" ? "rtl" : "ltr"}
            >
              {s.rationale}
            </p>
            <pre
              className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/40 p-2 text-xs text-foreground"
              dir={props.language === "ar" ? "rtl" : "ltr"}
            >
              {s.proposedText}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── SelectedTextPanel (mode='explain' or 'rewrite') ────────────────────────

function SelectedTextPanel({
  mode,
  ...props
}: Props & { mode: "explain" | "rewrite" }) {
  const { t } = useTranslation();
  const [selectedText, setSelectedText] = useState(
    props.initialSelectedText ?? "",
  );
  const [tone, setTone] = useState<AiDraftingAssistantTone>("balanced");
  const [output, setOutput] = useState("");

  const { isStreaming, start, abort } = useAiDraftingSseStream({
    onToken: (delta) => setOutput((p) => p + delta),
    onDone: () => {
      // Nothing else to do.
    },
    onError: (err) => {
      toast.error(
        err.message ??
          t("ai.errors.streamFailed", { defaultValue: "Streaming failed" }),
      );
    },
  });

  const trigger = () => {
    setOutput("");
    if (selectedText.trim().length === 0) {
      toast.error(t("ai.drafting.selectedText.required"));
      return;
    }
    void start({
      mode,
      contractType: props.contractType,
      partyA: props.partyA,
      partyB: props.partyB,
      draftSummary: props.draftSummary,
      existingClauseCategories: props.existingClauseCategories,
      language: props.language,
      selectedText,
      tone: mode === "rewrite" ? tone : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label
          className="block text-xs font-medium text-foreground"
          htmlFor="ai-drafting-selected-text"
        >
          {t("ai.drafting.selectedText.label")}
        </label>
        <textarea
          id="ai-drafting-selected-text"
          rows={4}
          value={selectedText}
          onChange={(e) => setSelectedText(e.target.value)}
          maxLength={20_000}
          placeholder={t("ai.drafting.selectedText.placeholder")}
          dir={props.language === "ar" ? "rtl" : "ltr"}
          className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      {mode === "rewrite" && (
        <div>
          <label
            className="block text-xs font-medium text-foreground"
            htmlFor="ai-drafting-tone"
          >
            {t("ai.drafting.tone.label")}
          </label>
          <select
            id="ai-drafting-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value as AiDraftingAssistantTone)}
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {TONES.map((tt) => (
              <option key={tt} value={tt}>
                {t(`ai.drafting.tone.values.${tt}`, { defaultValue: tt })}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-2">
        {isStreaming ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => abort()}
            aria-label={t("ai.drafting.chat.stop")}
          >
            <Square className="me-1 h-3.5 w-3.5" aria-hidden />
            {t("ai.drafting.chat.stop")}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={trigger}>
            <Sparkles className="me-1 h-3.5 w-3.5" aria-hidden />
            {mode === "explain"
              ? t("ai.drafting.explain.run")
              : t("ai.drafting.rewrite.run")}
          </Button>
        )}
      </div>
      <div
        className="min-h-24 rounded-md border border-border bg-muted/30 p-3 text-sm"
        aria-live="polite"
        dir={props.language === "ar" ? "rtl" : "ltr"}
      >
        {output.length === 0 && !isStreaming ? (
          <p className="text-xs text-muted-foreground">
            {t("ai.drafting.output.empty")}
          </p>
        ) : (
          <p className="whitespace-pre-line text-foreground">
            {output}
            {isStreaming && (
              <span
                className="ms-0.5 inline-block h-4 w-[2px] -translate-y-[1px] bg-primary align-middle"
                aria-hidden
              />
            )}
          </p>
        )}
      </div>
    </div>
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
      <CardContent className="p-3 text-xs text-destructive">
        <p>{message}</p>
        <button
          onClick={onRetry}
          className="mt-1 font-medium underline-offset-2 hover:underline"
        >
          {t("common.retry")}
        </button>
      </CardContent>
    </Card>
  );
}
