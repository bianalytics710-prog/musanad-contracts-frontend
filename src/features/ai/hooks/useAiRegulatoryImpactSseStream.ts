/**
 * Musanad — AI Regulatory Impact SSE streaming hook (M4 — S4).
 *
 * mode='explain' or 'amendment' streams the BE's analysis of a regulatory
 * update vs a sample of contracts. STATELESS — caller passes regulatory
 * text in the request payload (regulatory_update table doesn't exist yet,
 * deferred to M5 per Q1 of gate2-decisions.md).
 *
 * Uses fetch + ReadableStream because EventSource cannot send the
 * Authorization header. Mirrors M3 useSignerQaSseStream verbatim.
 *
 * Wire format: data: <JSON of AiRegulatoryImpactStreamChunk>\n\n
 *
 * SECURITY:
 *   - summaryEn (regulatory text body) is SENSITIVE — flows through fetch
 *     body only; never console-logged.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { buildRegulatoryImpactUrl } from "@/services/api/ai.service";
import { useAuthStore } from "@/store/auth.store";
import type {
  AiRegulatoryImpactRequest,
  AiRegulatoryImpactStreamChunk,
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

export interface UseAiRegulatoryImpactSseStreamArgs {
  onToken: (delta: string) => void;
  onDone: (tokensConsumed: number) => void;
  onError: (err: {
    code: string;
    message?: string;
    retryAfterSeconds?: number;
  }) => void;
}

export interface UseAiRegulatoryImpactSseStreamReturn {
  isStreaming: boolean;
  start: (payload: AiRegulatoryImpactRequest) => Promise<void>;
  abort: () => void;
}

const SSE_DELIMITER = "\n\n";

function safeParseChunk(
  payload: string,
): AiRegulatoryImpactStreamChunk | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      typeof (parsed as { type: unknown }).type === "string"
    ) {
      return parsed as AiRegulatoryImpactStreamChunk;
    }
    return null;
  } catch {
    return null;
  }
}

export function useAiRegulatoryImpactSseStream(
  args: UseAiRegulatoryImpactSseStreamArgs,
): UseAiRegulatoryImpactSseStreamReturn {
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
    async (payload: AiRegulatoryImpactRequest): Promise<void> => {
      if (isStreaming) return;
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) {
        onError({ code: "UNAUTHORIZED" });
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsStreaming(true);

      try {
        const resp = await fetch(buildRegulatoryImpactUrl(), {
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
