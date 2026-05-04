/**
 * SignerQADrawer (S11 + S12) — non-advisory signer Q&A AI chat drawer.
 *
 * Mode: regenerate — Lovable's SignerQADrawer.tsx hits the Supabase edge
 * function directly with no session token + no rate limit awareness; M3
 * introduces session start (POST /qa/session) + GATE/COMMIT SSE streaming
 * (POST /qa/message). Per memory `feedback_regenerate_when_lovable_too_coupled.md`.
 *
 * Behaviour:
 *   - Drawer opens → POST /qa/session once (lazy). On success, hold the
 *     plaintextSessionToken in component state (NEVER persisted).
 *   - User types message → start SSE stream via useSignerQaSseStream.
 *   - Stream tokens append to the active assistant message.
 *   - Stream done → finalise message + show remaining rate-limit count.
 *   - Stream error → toast + clear streaming state.
 *   - On drawer close: discard sessionToken + abort in-flight stream.
 *
 * AC mapping:
 *   AC-S11-01..06:
 *     - Session opens automatically.
 *     - language defaults to invitation.language (caller passes it).
 *     - sliding-window soft-deactivate handled DB-side.
 *   AC-S12-01..10:
 *     - SSE streaming via fetch + ReadableStream.
 *     - 429 surfaces a rate-limit toast with retryAfterSeconds.
 *     - userMessage NEVER persisted (DN-11) — discarded after submission.
 *
 * 13-checklist mapping:
 *   T1/T2 — service via signatureService + useSignerQaSseStream + RQ mutation.
 *   T3    — every label uses t().
 *   T4    — three states: opening session / streaming / error.
 *   T5    — semantic Tailwind tokens.
 *   T6    — useFocusTrap + Esc-close + role="dialog" + aria-live for stream.
 *   T7    — full type safety.
 *   T13   — sessionTokenPlaintext + userMessage NEVER logged or persisted.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Send, ShieldAlert, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useSignerQaSessionStart } from "@/features/signatures/hooks/useSignatures";
import { useSignerQaSseStream } from "@/features/signatures/hooks/useSignerQaSseStream";
import { translateApiError } from "@/lib/translate-api-error";
import type { SignatureLanguage } from "@/types/entities/signature.types";
import { cn } from "@/lib/utils";

interface Props {
  invitationToken: string;
  /** Locked language from invitation.language (S3). */
  language: SignatureLanguage;
  open: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

export function SignerQADrawer({
  invitationToken,
  language,
  open,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const inputId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /**
   * Plaintext session token — held in component state ONLY.
   * Never written to localStorage / sessionStorage / cookies.
   * Cleared on drawer close + on unmount.
   */
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const nextMessageIdRef = useRef(1);

  const sessionStart = useSignerQaSessionStart({
    onSuccess: (resp) => {
      setSessionToken(resp.data.sessionTokenPlaintext);
      setRemaining(resp.data.rateLimit.remaining);
    },
    onError: (err) => {
      toast.error(translateApiError(err, t, "errors.signatures.qaSessionFailed"));
    },
  });

  const handleToken = useCallback((delta: string) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") {
        next[next.length - 1] = { ...last, content: last.content + delta };
      }
      return next;
    });
  }, []);

  const handleDone = useCallback(
    (_tokensConsumed: number) => {
      // Per BE-OI-2: tokensConsumed may be 1 even when actual usage isn't
      // reported by upstream; we trust the BE COMMIT call to handle the
      // accounting and just decrement our local remaining count optimistically.
      if (remaining !== null && remaining > 0) {
        setRemaining(remaining - 1);
      }
    },
    [remaining],
  );

  const handleStreamError = useCallback(
    (err: { code: string; message?: string; retryAfterSeconds?: number }) => {
      // Replace the placeholder assistant message with an inline error tag.
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && last.content === "") {
          // Drop the empty placeholder.
          next.pop();
        }
        return next;
      });
      const code = err.code;
      if (code === "rate_limit_exceeded") {
        const seconds = err.retryAfterSeconds ?? 1800;
        toast.error(
          t("sign.m3.qa.errors.rateLimit", {
            minutes: Math.ceil(seconds / 60),
          }),
        );
      } else if (
        code === "session_invalid_or_expired" ||
        code === "invitation_invalid_or_expired"
      ) {
        toast.error(t("sign.m3.qa.errors.sessionExpired"));
      } else {
        toast.error(t("sign.m3.qa.errors.generic"));
      }
    },
    [t],
  );

  const stream = useSignerQaSseStream({
    invitationToken,
    sessionToken,
    onToken: handleToken,
    onDone: handleDone,
    onError: handleStreamError,
  });

  useFocusTrap(dialogRef, open);

  // Open the session lazily on first open. Reset on close.
  useEffect(() => {
    if (open) {
      if (!sessionToken && !sessionStart.isPending) {
        sessionStart.mutate({ invitationToken, data: { language } });
      }
    } else {
      // Discard everything on close — abort any in-flight stream.
      stream.abort();
      setSessionToken(null);
      setRemaining(null);
      setMessages([]);
      setInput("");
      sessionStart.reset();
      nextMessageIdRef.current = 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-scroll to bottom on new tokens.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, stream.isStreaming]);

  if (!open) return null;

  const canSend =
    sessionToken !== null &&
    !stream.isStreaming &&
    input.trim().length > 0 &&
    (remaining === null || remaining > 0);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!canSend || !text) return;
    const userMsg: ChatMessage = {
      id: nextMessageIdRef.current++,
      role: "user",
      content: text,
    };
    const assistantPlaceholder: ChatMessage = {
      id: nextMessageIdRef.current++,
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInput("");
    void stream.start(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-xl"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="flex items-center gap-2 text-base font-semibold text-ink"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              {t("sign.m3.qa.title")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {t("sign.m3.qa.subtitle")}
            </p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Disclaimer (T13: never log this — it's just copy) */}
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-amber/40 bg-amber-tint/40 p-3 text-[11px] text-amber-ink">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          <p>{t("sign.m3.qa.disclaimer")}</p>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3"
          role="log"
          aria-live="polite"
          aria-label={t("sign.m3.qa.messagesLabel")}
        >
          {sessionStart.isPending && (
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t("sign.m3.qa.openingSession")}
            </div>
          )}
          {sessionStart.isError && (
            <div role="alert" className="text-xs text-destructive">
              {translateApiError(
                sessionStart.error,
                t,
                "errors.signatures.qaSessionFailed",
              )}
            </div>
          )}
          {messages.length === 0 && sessionToken && !stream.isStreaming && (
            <p className="text-xs text-ink-subtle">
              {t("sign.m3.qa.empty")}
            </p>
          )}
          <ul className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-ink text-background"
                      : "border border-border bg-card text-ink",
                  )}
                >
                  {m.content || (m.role === "assistant" && stream.isStreaming
                    ? "…"
                    : "")}
                </div>
              </li>
            ))}
          </ul>
          {stream.isStreaming && (
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t("sign.m3.qa.thinking")}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="border-t border-border bg-background px-4 py-3"
        >
          <div className="flex items-end gap-2">
            <label htmlFor={inputId} className="sr-only">
              {t("sign.m3.qa.inputLabel")}
            </label>
            <textarea
              id={inputId}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as unknown as React.FormEvent);
                }
              }}
              rows={1}
              placeholder={t("sign.m3.qa.placeholder") as string}
              maxLength={8000}
              disabled={!sessionToken || stream.isStreaming}
              className={cn(
                "max-h-32 min-h-10 flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              aria-label={t("sign.m3.qa.send")}
            >
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          {remaining !== null && (
            <p className="mt-1 text-[10px] text-ink-subtle">
              {t("sign.m3.qa.remaining", { n: remaining })}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default SignerQADrawer;
