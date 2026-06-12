/**
 * AI Chat Orchestrator — SSE streaming service.
 *
 * Mirrors risk-assistant.service.ts (native fetch + ReadableStream since
 * apiClient is axios-wrapped). Emits a tagged-union event stream that
 * RiskAssistantPanel + ProposalCard consume.
 */
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import type {
  ChatAskBody,
  ChatMention,
  ChatMessage,
  ProposalPreviewParam,
  ProposalReceipt,
} from '@/types/entities/chat-orchestrator.types';

const DEFAULT_BASE_URL = 'http://localhost:4000';

function getApiBaseUrl(): string {
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return env && env.trim() !== '' ? env : DEFAULT_BASE_URL;
}

function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

// ─── Tagged union event stream ─────────────────────────────────────────

export type ChatSSEEvent =
  | { type: 'token'; token: string }
  | { type: 'resolverUsed'; code: string; label: string; args: Record<string, unknown> }
  | {
      type: 'proposal';
      proposalId: string;
      actionCode: string;
      actionLabel: string;
      previewParams: ProposalPreviewParam[];
      rawParams: Record<string, unknown>;
    }
  | { type: 'done'; requestLogId?: string }
  | { type: 'error'; code: string; message: string };

interface RawEnvelope {
  event: string;
  data: Record<string, unknown>;
}

export interface AskChatOptions {
  messages: ChatMessage[];
  mentions: ChatMention[];
  onEvent: (evt: ChatSSEEvent) => void;
  abortSignal?: AbortSignal;
}

export async function askChat(opts: AskChatOptions): Promise<void> {
  const token = getAccessToken();
  const url = `${getApiBaseUrl()}/api/v1/ai/chat/ask`;
  const body: ChatAskBody = {
    messages: opts.messages,
    mentions: opts.mentions,
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
    let errorMsg = `HTTP ${response.status}`;
    try {
      const j = (await response.json()) as { error?: { message?: string } };
      if (j?.error?.message) errorMsg = j.error.message;
    } catch {
      /* ignore */
    }
    opts.onEvent({ type: 'error', code: 'http_error', message: errorMsg });
    return;
  }
  if (!response.body) {
    opts.onEvent({ type: 'error', code: 'no_body', message: 'No response body.' });
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
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const raw of events) {
        const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const json = dataLine.slice('data:'.length).trim();
        if (!json) continue;
        try {
          const env = JSON.parse(json) as RawEnvelope;
          switch (env.event) {
            case 'token': {
              const d = env.data as { token?: string };
              if (d.token) opts.onEvent({ type: 'token', token: d.token });
              break;
            }
            case 'resolverUsed': {
              const d = env.data as { code?: string; label?: string; arguments?: Record<string, unknown> };
              opts.onEvent({
                type: 'resolverUsed',
                code: d.code ?? '',
                label: d.label ?? '',
                args: d.arguments ?? {},
              });
              break;
            }
            case 'proposal': {
              const d = env.data as {
                proposalId?: string;
                actionCode?: string;
                actionLabel?: string;
                previewParams?: ProposalPreviewParam[];
                rawParams?: Record<string, unknown>;
              };
              opts.onEvent({
                type: 'proposal',
                proposalId: d.proposalId ?? '',
                actionCode: d.actionCode ?? '',
                actionLabel: d.actionLabel ?? '',
                previewParams: d.previewParams ?? [],
                rawParams: d.rawParams ?? {},
              });
              break;
            }
            case 'done': {
              const d = env.data as { requestLogId?: string };
              opts.onEvent({ type: 'done', requestLogId: d.requestLogId });
              return;
            }
            case 'error': {
              const d = env.data as { code?: string; message?: string };
              opts.onEvent({
                type: 'error',
                code: d.code ?? 'unknown',
                message: d.message ?? 'Stream error.',
              });
              return;
            }
            default:
              break;
          }
        } catch {
          /* malformed chunk — skip */
        }
      }
    }
  } catch (err) {
    if (opts.abortSignal?.aborted) return;
    const m = err instanceof Error ? err.message : 'stream read error';
    opts.onEvent({ type: 'error', code: 'read_error', message: m });
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

// ─── Execute / reject — REST round-trips ───────────────────────────────

export interface ExecuteProposalResponse {
  proposalId: string;
  actionCode: string;
  receipt: ProposalReceipt;
}

export const chatActionsService = {
  execute: async (proposalId: string): Promise<ExecuteProposalResponse> => {
    const { data } = await apiClient.post<ExecuteProposalResponse>(
      '/api/v1/ai/chat/execute',
      { proposalId },
    );
    return data;
  },
  reject: async (proposalId: string, reason?: string): Promise<{ proposalId: string; outcome: string }> => {
    const { data } = await apiClient.post<{ proposalId: string; outcome: string }>(
      '/api/v1/ai/chat/reject',
      { proposalId, reason },
    );
    return data;
  },
};
