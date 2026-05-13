/**
 * M15 / CR-G — AI Risk Assistant SSE streaming service.
 *
 * A7 compliance: all HTTP calls go through this service module.
 *
 * Endpoint:
 *   POST /api/v1/ai/risk-assistant/ask  (SSE streaming; ?stream=false for non-streaming)
 *
 * Security:
 *   - query and filters are SENSITIVE — never logged (Pino redact on BE; never console.log here)
 *   - Bearer token attached via getAccessToken() — reads from auth store directly (no apiClient
 *     because apiClient wraps fetch as axios; SSE requires native fetch + ReadableStream)
 *   - AbortController supported via opts.abortSignal
 *
 * SSE event format (each line): "data: <JSON>\n\n"
 * Event JSON shape: { event: 'token'|'citation'|'done'|'error', data: { ... } }
 */

import { useAuthStore } from '@/store/auth.store';
import type {
  RiskAssistantAskRequest,
  RiskAssistantCitation,
  RiskAssistantPersona,
  AvarFilters,
} from '@/types/entities/risk-assistant.types';

const DEFAULT_BASE_URL = 'http://localhost:4000';

function getApiBaseUrl(): string {
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return env && env.trim() !== '' ? env : DEFAULT_BASE_URL;
}

function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

export interface AskRiskAssistantOptions {
  query: string;
  persona?: RiskAssistantPersona;
  filters?: AvarFilters;
  onToken: (token: string) => void;
  onCitation: (citation: RiskAssistantCitation) => void;
  onDone: (requestLogId?: string) => void;
  onError: (message: string) => void;
  abortSignal?: AbortSignal;
}

/**
 * Streams a risk assistant response via SSE.
 *
 * Dispatches callbacks for each SSE event type. Callers are responsible for
 * assembling token chunks into the full response string.
 *
 * Throws on HTTP-level errors (non-2xx before stream opens — e.g. 401, 403, 429).
 */
export async function askRiskAssistant(opts: AskRiskAssistantOptions): Promise<void> {
  const token = getAccessToken();
  const url = `${getApiBaseUrl()}/api/v1/ai/risk-assistant/ask`;

  const body: RiskAssistantAskRequest = {
    query: opts.query,
    ...(opts.persona !== undefined && { persona: opts.persona }),
    ...(opts.filters !== undefined && { filters: opts.filters }),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Request-ID': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
    signal: opts.abortSignal,
  });

  if (!response.ok) {
    // Non-streaming error (403, 429, 400) — surface before stream starts
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errBody = await response.json() as { error?: { message?: string } };
      if (errBody?.error?.message) errorMsg = errBody.error.message;
    } catch {
      // ignore parse failures
    }
    opts.onError(errorMsg);
    return;
  }

  if (!response.body) {
    opts.onError('No response body received from server.');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE lines are separated by "\n\n"
      const events = buffer.split('\n\n');
      // Keep the last (potentially incomplete) chunk in the buffer
      buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        const dataLine = rawEvent
          .split('\n')
          .find((line) => line.startsWith('data:'));
        if (!dataLine) continue;

        const jsonStr = dataLine.slice('data:'.length).trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr) as {
            event: 'token' | 'citation' | 'done' | 'error';
            data: {
              token?: string;
              citation?: RiskAssistantCitation;
              error?: string;
              requestLogId?: string;
            };
          };

          switch (parsed.event) {
            case 'token':
              if (parsed.data.token) {
                opts.onToken(parsed.data.token);
              }
              break;
            case 'citation':
              if (parsed.data.citation) {
                opts.onCitation(parsed.data.citation);
              }
              break;
            case 'done':
              opts.onDone(parsed.data.requestLogId);
              return;
            case 'error':
              opts.onError(parsed.data.error ?? 'Unknown streaming error');
              return;
          }
        } catch {
          // Malformed JSON chunk — skip silently (stream continues)
        }
      }
    }
  } catch (err) {
    if (opts.abortSignal?.aborted) {
      // User cancelled — not an error
      return;
    }
    const msg = err instanceof Error ? err.message : 'Stream read error';
    opts.onError(msg);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
