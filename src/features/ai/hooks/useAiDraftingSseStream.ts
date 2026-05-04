/**
 * Musanad — AI Drafting Assistant SSE streaming hook (M4 — S2).
 *
 * For mode='chat' / 'explain' / 'rewrite' — fetch + ReadableStream because
 * EventSource cannot send the Authorization header. Mirrors M3
 * useSignerQaSseStream verbatim for wire format and lifecycle.
 *
 * Wire format: data: <JSON of AiDraftingAssistantStreamChunk>\n\n
 *
 * SECURITY:
 *   - selectedText, chatHistory, draftSummary flow through fetch body —
 *     never logged client-side. Pino redaction handles BE.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { buildDraftingAssistantUrl } from "@/services/api/ai.service";
import { useAuthStore } from "@/store/auth.store";
import type {
  AiDraftingAssistantRequest,
  AiDraftingAssistantStreamChunk,
} from "@/types/entities/ai.types";

interface PreStreamErrorBody {
  success: false;
  error: {
    code: string;
    message?: string;
    details?: { retryAfterSeconds?: number } | null;
  };
  requestId?: string;
}

export interface UseAiDraftingSseStreamArgs {
  onToken: (delta: string) => void;
  onDone: (tokensConsumed: number) => void;
  onError: (err: {
    code: string;
    message?: string;
    retryAfterSeconds?: number;
  }) => void;
}

export interface UseAiDraftingSseStreamReturn {
  isStreaming: boolean;
  start: (payload: AiDraftingAssistantRequest) => Promise<void>;
  abort: () => void;
}

const SSE_DELIMITER = "\n\n";

function safeParseChunk(payload: string): AiDraftingAssistantStreamChunk | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      typeof (parsed as { type: unknown }).type === "string"
    ) {
      return parsed as AiDraftingAssistantStreamChunk;
    }
    return null;
  } catch {
    return null;
  }
}

export function useAiDraftingSseStream(
  args: UseAiDraftingSseStreamArgs,
): UseAiDraftingSseStreamReturn {
  const { onToken, onDone, onError } = args;
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
    async (payload: AiDraftingAssistantRequest): Promise<void> => {
      if (isStreaming) return;
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) {
        onError({ code: "UNAUTHORIZED" });
        return;
      }
      if (payload.mode === "suggest") {
        onError({
          code: "INVALID_MODE",
          message: "SSE hook does not handle mode='suggest' (use the synchronous service).",
        });
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsStreaming(true);

      try {
        const resp = await fetch(buildDraftingAssistantUrl(), {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        const contentType = resp.headers.get("content-type") ?? "";
        if (!resp.ok || !contentType.includes("text/event-stream")) {
          let parsed: PreStreamErrorBody | null = null;
          try {
            parsed = (await resp.json()) as PreStreamErrorBody;
          } catch {
            // Fall through.
          }
          if (parsed && parsed.success === false && parsed.error) {
            onError({
              code: parsed.error.code,
              message: parsed.error.message,
              retryAfterSeconds: parsed.error.details?.retryAfterSeconds,
            });
          } else {
            onError({
              code: resp.status === 429 ? "RATE_LIMITED" : "stream_failed",
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

            const dataLines = event
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trimStart());
            if (dataLines.length === 0) continue;
            const dataPayload = dataLines.join("\n");
            if (dataPayload === "[DONE]") {
              onDone(1);
              terminated = true;
              break;
            }
            const chunk = safeParseChunk(dataPayload);
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
          return;
        }
        onError({ code: "stream_failed", message: (err as Error).message });
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [isStreaming, onToken, onDone, onError],
  );

  return { isStreaming, start, abort };
}
