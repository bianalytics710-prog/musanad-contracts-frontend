/**
 * Musanad — Signer Q&A SSE streaming hook (M3 — S12).
 *
 * The native EventSource API cannot send custom headers (X-Session-Token) and
 * is GET-only. We therefore implement SSE consumption manually via fetch +
 * ReadableStream + a TextDecoder. Mirrors BE wire format:
 *
 *     data: <JSON of SignerQaMessageStreamChunk>\n\n
 *
 * Three chunk variants:
 *   - { type: 'token',  delta: 'word ' }                       — streaming AI tokens
 *   - { type: 'done',   tokensConsumed: 142 }                  — terminal
 *   - { type: 'error',  code: '...', retryAfterSeconds?: 1800 } — terminal
 *
 * Lifecycle:
 *   1. Caller invokes `start(userMessage)` after they have a sessionToken
 *      from POST /qa/session.
 *   2. Hook POSTs mode='GATE' + tokensConsumed=0 + userMessage to
 *      /qa/message with X-Session-Token header.
 *   3. On 200 + text/event-stream, hook reads the body stream chunk by
 *      chunk, dispatches token / done / error to the caller via
 *      onToken / onDone / onError callbacks.
 *   4. On 4xx (before stream flips), hook surfaces the JSON error envelope
 *      via onError. 429 includes retryAfterSeconds for rate-limit toast UX.
 *
 * Pre-stream errors:
 *   - The BE flips SSE headers AFTER GATE + getByInvitationToken pass. So
 *     a 410/429 may arrive as a JSON error body with status 410/429 and
 *     content-type application/json — NOT as an SSE error chunk. We handle
 *     both cases in this hook.
 *
 * SECURITY:
 *   - userMessage flows through fetch body — never logged client-side.
 *   - X-Session-Token header — never echoed back; pino-redacted on BE.
 *   - sessionToken plaintext is held only in the caller's component state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { buildQaMessageUrl } from "@/services/api/signature.service";
import type {
  SignerQaMessageStreamChunk,
  SignerQaRecordMessageDto,
} from "@/types/entities/signature.types";

interface PreStreamErrorBody {
  success: false;
  error: { code: string; message?: string; details?: { retryAfterSeconds?: number } | null };
  requestId?: string;
}

export interface UseSignerQaSseStreamArgs {
  invitationToken: string | null;
  sessionToken: string | null;
  /** Called once per `token` chunk with the delta string. */
  onToken: (delta: string) => void;
  /** Called once on terminal `done` chunk with the upstream tokensConsumed. */
  onDone: (tokensConsumed: number) => void;
  /**
   * Called on:
   *  - pre-stream JSON error envelope (4xx)
   *  - SSE `error` chunk (terminal)
   *  - network error / abort
   */
  onError: (err: { code: string; message?: string; retryAfterSeconds?: number }) => void;
}

export interface UseSignerQaSseStreamReturn {
  /** True while a stream is actively being consumed. */
  isStreaming: boolean;
  /** Begin a stream with the user's message. No-op while already streaming. */
  start: (userMessage: string) => Promise<void>;
  /** Manually abort the in-flight stream. */
  abort: () => void;
}

const SSE_DELIMITER = "\n\n";

function safeParseChunk(payload: string): SignerQaMessageStreamChunk | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      typeof (parsed as { type: unknown }).type === "string"
    ) {
      return parsed as SignerQaMessageStreamChunk;
    }
    return null;
  } catch {
    return null;
  }
}

export function useSignerQaSseStream(
  args: UseSignerQaSseStreamArgs,
): UseSignerQaSseStreamReturn {
  const { invitationToken, sessionToken, onToken, onDone, onError } = args;
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Always cancel any in-flight stream on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const start = useCallback(
    async (userMessage: string): Promise<void> => {
      if (isStreaming) return;
      if (!invitationToken || !sessionToken) {
        onError({ code: "session_invalid_or_expired" });
        return;
      }

      const trimmed = userMessage.trim();
      if (trimmed.length === 0) return;

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsStreaming(true);

      const body: SignerQaRecordMessageDto = {
        mode: "GATE",
        tokensConsumed: 0,
        userMessage: trimmed,
      };

      try {
        const resp = await fetch(buildQaMessageUrl(invitationToken), {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "X-Session-Token": sessionToken,
          },
          body: JSON.stringify(body),
        });

        // Pre-stream error path — BE returns JSON envelope BEFORE flipping
        // headers when invitation/session is invalid or rate-limit hits.
        const contentType = resp.headers.get("content-type") ?? "";
        if (!resp.ok || !contentType.includes("text/event-stream")) {
          let parsed: PreStreamErrorBody | null = null;
          try {
            parsed = (await resp.json()) as PreStreamErrorBody;
          } catch {
            // Fall through to a generic error below.
          }
          if (parsed && parsed.success === false && parsed.error) {
            onError({
              code: parsed.error.code,
              message: parsed.error.message,
              retryAfterSeconds: parsed.error.details?.retryAfterSeconds,
            });
          } else {
            onError({
              code: resp.status === 429 ? "rate_limit_exceeded" : "stream_failed",
              message: resp.statusText,
            });
          }
          return;
        }

        if (!resp.body) {
          onError({ code: "stream_failed" });
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buf = "";
        let terminated = false;

        while (!terminated) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let delimIdx: number;
          while ((delimIdx = buf.indexOf(SSE_DELIMITER)) !== -1) {
            const event = buf.slice(0, delimIdx);
            buf = buf.slice(delimIdx + SSE_DELIMITER.length);

            // Parse the line — we only care about lines starting with `data: `.
            // Multi-line `data:` events are uncommon for our wire format but
            // handled defensively by joining on '\n'.
            const dataLines = event
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trimStart());
            if (dataLines.length === 0) continue;
            const payload = dataLines.join("\n");
            if (payload === "[DONE]") {
              // Some upstreams use this terminal sentinel — treat as
              // generic done with tokensConsumed=1 to satisfy COMMIT
              // (matches BE OpenAI usage-missing fallback).
              onDone(1);
              terminated = true;
              break;
            }
            const chunk = safeParseChunk(payload);
            if (!chunk) continue;
            if (chunk.type === "token") {
              onToken(chunk.delta);
            } else if (chunk.type === "done") {
              onDone(chunk.tokensConsumed);
              terminated = true;
              break;
            } else if (chunk.type === "error") {
              onError({
                code: chunk.code,
                message: chunk.message,
                retryAfterSeconds: chunk.retryAfterSeconds,
              });
              terminated = true;
              break;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Caller-initiated cancel — silent.
          return;
        }
        onError({ code: "stream_failed", message: (err as Error).message });
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [invitationToken, sessionToken, isStreaming, onToken, onDone, onError],
  );

  return { isStreaming, start, abort };
}
