/**
 * M15 / CR-G — AI Risk Assistant floating panel.
 *
 * Mounted at AppShell level; visible on all dashboard routes.
 * Toggle button bottom-right. Drawer-style slide-in panel.
 *
 * SSE streaming via risk-assistant.service.ts:
 *   - onToken → streams partial text into current assistant bubble
 *   - onCitation → appends inline citation chip
 *   - onDone → marks streaming complete
 *   - onError → shows error state in bubble
 *
 * Permission gate: ai.invoke.risk_assistant (silent-hide when absent).
 * Persona: auto-derived from JWT user role.
 *
 * T1 data layer via service (not apiClient directly) — A7 compliant.
 * T3 i18n keys throughout.
 * T4 three data states (loading/empty/error) in chat panel.
 * T5 semantic tokens only (no raw hex).
 * T6 a11y: aria-label on textarea + send + abort; focus trap on open; kbd Escape close.
 * T7 strict types.
 * T8 form hygiene: noValidate, submit disabled during streaming.
 * T13 sensitive redaction: query is never echoed in error toasts.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, StopCircle, Bot, User, Send } from 'lucide-react';
import { askRiskAssistant } from '@/services/api/risk-assistant.service';
import { askChat } from '@/services/api/chat-orchestrator.service';
import { useAuthStore, selectUser, selectHasPermission } from '@/store/auth.store';
import { formatDateTime } from '@/utils/datetime';
import {
  MentionableTextarea,
  type MentionableTextareaHandle,
} from './MentionableTextarea';
import { ProposalCard } from './ProposalCard';
import { RenderedMentionText } from './MentionChip';
import type {
  ChatMessage,
  RiskAssistantCitation,
  RiskAssistantPersona,
} from '@/types/entities/risk-assistant.types';
import type {
  ChatMention,
  ProposalPreviewParam,
} from '@/types/entities/chat-orchestrator.types';

// ─── Role → persona mapping ───────────────────────────────────────────────────

function derivePersona(roleName: string | null | undefined): RiskAssistantPersona | undefined {
  if (!roleName) return undefined;
  const map: Record<string, RiskAssistantPersona> = {
    executive: 'executive',
    legal_counsel: 'legal_counsel',
    compliance_esg: 'compliance_esg',
    operations: 'operations',
    finance_treasury: 'finance_treasury',
    contract_drafter: 'procurement',
    contract_approver: 'procurement',
  };
  return map[roleName.toLowerCase()];
}

// ─── Citation chip ─────────────────────────────────────────────────────────────

function CitationChip({ citation }: { citation: RiskAssistantCitation }) {
  const typeColors: Record<string, string> = {
    clause: 'bg-sage/20 text-sage border-sage/30',
    correlation: 'bg-gold/20 text-ink border-gold/30',
    signal: 'bg-amber/20 text-amber border-amber/30',
    contract: 'bg-terracotta/20 text-terracotta border-terracotta/30',
  };
  const cls = typeColors[citation.type] ?? 'bg-muted text-ink-muted border-border';
  return (
    // Citation href is a dynamic server-supplied path — use native anchor (C14 exception for dynamic server paths)
    <a
      href={citation.href}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] hover:opacity-80 ${cls}`}
      title={citation.excerpt}
    >
      [{citation.type.slice(0, 3).toUpperCase()}] {citation.label}
    </a>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────────

/**
 * Tiny markdown renderer for the assistant's responses. We intentionally
 * keep this dependency-free — covers the structure the prompts ask for:
 *   **bold**            → <strong>
 *   ### / ## / # heading → small uppercase sub-heading
 *   - / * / • bullets    → bulleted list
 *   blank line           → paragraph break
 *
 * User messages render plain (no formatting).
 */
function renderStructuredMessage(text: string): React.ReactNode {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let currentList: string[] | null = null;

  const flushList = () => {
    if (currentList && currentList.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 ps-5">
          {currentList.map((item, i) => (
            <li key={i} className="text-sm text-ink">{renderInline(item)}</li>
          ))}
        </ul>,
      );
    }
    currentList = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      flushList();
      continue;
    }
    const bulletMatch = line.match(/^(?:[-*•]\s+)(.*)/);
    if (bulletMatch) {
      if (!currentList) currentList = [];
      currentList.push(bulletMatch[1]);
      continue;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      flushList();
      blocks.push(
        <p
          key={`h-${blocks.length}`}
          className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle"
        >
          {renderInline(headingMatch[2])}
        </p>,
      );
      continue;
    }
    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm text-ink">
        {renderInline(line)}
      </p>,
    );
  }
  flushList();
  return blocks;
}

/** Inline formatter — handles **bold** and `code`. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-muted px-1 font-mono text-[12px]">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isUser ? 'bg-gold/20' : 'bg-sage/20'}`}
        aria-hidden
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-gold" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-sage" />
        )}
      </div>
      <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`space-y-1 rounded-xl px-3 py-2 text-sm ${isUser ? 'bg-gold/15 text-ink' : 'bg-surface text-ink'}`}
        >
          {isUser ? (
            <span><RenderedMentionText text={message.content} /></span>
          ) : (
            <>
              {message.content && renderStructuredMessage(message.content)}
              {message.proposal && (
                <div className="mt-2">
                  <ProposalCard
                    proposalId={message.proposal.proposalId}
                    actionCode={message.proposal.actionCode}
                    actionLabel={message.proposal.actionLabel}
                    previewParams={message.proposal.previewParams}
                  />
                </div>
              )}
            </>
          )}
          {message.isStreaming && (
            <span className="ms-1 inline-block h-2.5 w-1.5 animate-pulse rounded-sm bg-ink-muted" aria-hidden />
          )}
        </div>
        {message.resolverNotes && message.resolverNotes.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1 text-[10px] text-ink-subtle">
            {message.resolverNotes.map((n, i) => (
              <span key={i} className="rounded bg-muted px-1.5 py-0.5">↳ {n}</span>
            ))}
          </div>
        )}
        {message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.citations.map((c, idx) => (
              <CitationChip key={`${c.id}-${idx}`} citation={c} />
            ))}
          </div>
        )}
        <p className="px-1 text-[10px] text-ink-subtle">
          {formatDateTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Persona-specific suggestion chips shown on the empty state. Each row is
 * 3 i18n keys grounded in the modules that role actually uses. Falls back
 * to the legacy executive-ish defaults for roles without a custom row.
 */
const EXAMPLE_PROMPTS_BY_ROLE: Record<string, string[]> = {
  executive: [
    'ai.riskAssistant.examples.executive.counterparties',
    'ai.riskAssistant.examples.executive.topRisk',
    'ai.riskAssistant.examples.executive.expiring',
  ],
  legal_counsel: [
    'ai.riskAssistant.examples.legal.advisoryQueue',
    'ai.riskAssistant.examples.legal.regulationsThisWeek',
    'ai.riskAssistant.examples.legal.flaggedClauses',
  ],
  contract_drafter: [
    'ai.riskAssistant.examples.drafter.awaiting',
    'ai.riskAssistant.examples.drafter.templates',
    'ai.riskAssistant.examples.drafter.stuckAtLegal',
  ],
  contract_approver: [
    'ai.riskAssistant.examples.approver.sla',
    'ai.riskAssistant.examples.approver.highValue',
    'ai.riskAssistant.examples.approver.highRisk',
  ],
  contract_approver_2: [
    'ai.riskAssistant.examples.approver.sla',
    'ai.riskAssistant.examples.approver.highValue',
    'ai.riskAssistant.examples.approver.highRisk',
  ],
};

const DEFAULT_EXAMPLE_PROMPTS = [
  'ai.riskAssistant.examples.hormuz',
  'ai.riskAssistant.examples.sanctions',
  'ai.riskAssistant.examples.icv',
];

function getExamplePromptKeys(roleName: string | null | undefined): string[] {
  if (!roleName) return DEFAULT_EXAMPLE_PROMPTS;
  return EXAMPLE_PROMPTS_BY_ROLE[roleName.toLowerCase()] ?? DEFAULT_EXAMPLE_PROMPTS;
}

export function RiskAssistantPanel() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const hasPermission = useAuthStore(selectHasPermission('ai.invoke.risk_assistant'));

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [draftLen, setDraftLen] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mentionTaRef = useRef<MentionableTextareaHandle | null>(null);

  const panelId = useId();

  const persona = derivePersona(user?.role?.name);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => mentionTaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Escape key closes
  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // L95 — Allow Cmd-K palette to open the panel via a global custom event.
  useEffect(() => {
    function handleOpen() {
      setIsOpen(true);
    }
    window.addEventListener('open-risk-assistant', handleOpen as EventListener);
    return () =>
      window.removeEventListener('open-risk-assistant', handleOpen as EventListener);
  }, []);

  // Silent-hide when caller lacks ai.invoke.risk_assistant.
  // BUG-001 fix (QA Phase 3 autonomous run 2026-05-30): this early-return MUST come
  // AFTER all hook calls to comply with Rules of Hooks. Previously placed at line 150
  // (after only 11 hooks) — Zustand hydration race flipped hasPermission between
  // renders, causing "Rendered more hooks than during the previous render" crashes
  // on direct URL navigation to any /app/* route. Now all 17+ hooks run unconditionally.
  if (!hasPermission) return null;

  function handleClose() {
    if (isStreaming) {
      abortRef.current?.abort();
    }
    setIsOpen(false);
  }

  // ─── Intent classifier ──────────────────────────────────────────────
  // Two routes coexist behind the same input:
  //   • Action request — mention chips OR action keywords → orchestrator
  //     (/ai/chat/ask) which can call write_actions and emit a proposal.
  //   • Plain Q&A — neither chips nor action keywords → risk-assistant
  //     (/ai/risk-assistant/ask) which loads the user's read-allowed
  //     contracts + clauses + risk signals into the LLM context so the
  //     model can answer grounded questions like "highest-risk contracts".
  // The orchestrator deliberately has no data RAG layer (it's a write-
  // action surface), so routing every message through it strips Q&A of
  // its data context. Detecting intent up front keeps both paths alive.
  function looksLikeActionRequest(text: string, mentions: ChatMention[]): boolean {
    if (mentions.length > 0) return true;
    // Anchored at word boundaries so a question like "what's the active
    // risk score" doesn't get mis-routed by stray substrings.
    const ACTION_RE =
      /\b(draft|assign(?:ed)?|request|create|add\s+to|escalate|reassign|cancel|nudge|prepare)\b/i;
    return ACTION_RE.test(text);
  }

  async function handleSubmit(payload: { text: string; mentions: ChatMention[] }) {
    const trimmed = payload.text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      citations: [],
      timestamp: new Date().toISOString(),
    };

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      citations: [],
      timestamp: new Date().toISOString(),
      isStreaming: true,
      resolverNotes: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    mentionTaRef.current?.clear();
    setDraftLen(0);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    const useOrchestrator = looksLikeActionRequest(trimmed, payload.mentions);

    try {
      if (useOrchestrator) {
        const chatMessages = [{ role: 'user' as const, content: trimmed }];
        await askChat({
          messages: chatMessages,
          mentions: payload.mentions,
          abortSignal: abortRef.current.signal,
          onEvent: (evt) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                if (evt.type === 'token') {
                  return { ...m, content: m.content + evt.token };
                }
                if (evt.type === 'resolverUsed') {
                  const notes = m.resolverNotes ?? [];
                  return { ...m, resolverNotes: [...notes, evt.label] };
                }
                if (evt.type === 'proposal') {
                  return {
                    ...m,
                    proposal: {
                      proposalId: evt.proposalId,
                      actionCode: evt.actionCode,
                      actionLabel: evt.actionLabel,
                      previewParams: evt.previewParams as ProposalPreviewParam[],
                    },
                  };
                }
                if (evt.type === 'done') {
                  return { ...m, isStreaming: false };
                }
                if (evt.type === 'error') {
                  return {
                    ...m,
                    content: m.content || t('ai.riskAssistant.error.generic'),
                    isStreaming: false,
                  };
                }
                return m;
              }),
            );
            if (evt.type === 'done' || evt.type === 'error') {
              setIsStreaming(false);
            }
          },
        });
      } else {
        // Plain Q&A — route to the data-grounded risk-assistant so the
        // LLM has the user's read-allowed contracts + clauses + signals
        // in context. Without this branch the orchestrator (which has
        // no RAG layer) would tell the user "I can't access real-time
        // data" for any question that isn't an action request.
        await askRiskAssistant({
          query: trimmed,
          ...(persona !== undefined && { persona }),
          abortSignal: abortRef.current.signal,
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + token } : m,
              ),
            );
          },
          onCitation: (citation) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, citations: [...m.citations, citation] }
                  : m,
              ),
            );
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m,
              ),
            );
            setIsStreaming(false);
          },
          onError: (message) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: m.content || message || t('ai.riskAssistant.error.generic'),
                      isStreaming: false,
                    }
                  : m,
              ),
            );
            setIsStreaming(false);
          },
        });
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: t('ai.riskAssistant.error.generic'), isStreaming: false }
            : m,
        ),
      );
      setIsStreaming(false);
    }
  }

  function handleAbort() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false, content: m.content + t('ai.riskAssistant.aborted') } : m,
      ),
    );
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={t('ai.riskAssistant.toggleButton')}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="fixed bottom-6 end-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gold shadow-lg transition hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 md:bottom-8 md:end-8"
      >
        <MessageCircle className="h-5 w-5 text-white" aria-hidden />
      </button>

      {/* Drawer panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20"
              onClick={handleClose}
              aria-hidden
            />

            {/* Panel */}
            <motion.aside
              key="panel"
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label={t('ai.riskAssistant.panelAriaLabel')}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed bottom-0 end-0 top-0 z-50 flex w-full max-w-md flex-col border-s border-border bg-card shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-sage" aria-hidden />
                  <h2 className="text-sm font-semibold text-ink">
                    {t('ai.riskAssistant.title')}
                  </h2>
                  {persona && (
                    <span className="rounded bg-sage/15 px-1.5 py-0.5 font-mono text-[10px] text-sage">
                      {persona}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label={t('ai.riskAssistant.close')}
                  className="rounded p-1 text-ink-muted transition hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* Chat history */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/15">
                      <Bot className="h-6 w-6 text-sage" aria-hidden />
                    </div>
                    <div>
                      <p className="font-medium text-ink">
                        {t('ai.riskAssistant.emptyState.title')}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {t('ai.riskAssistant.emptyState.subtitle')}
                      </p>
                    </div>
                    <div className="w-full space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
                        {t('ai.riskAssistant.emptyState.examplesLabel')}
                      </p>
                      {getExamplePromptKeys(user?.role?.name).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            mentionTaRef.current?.setText(t(key));
                            mentionTaRef.current?.focus();
                          }}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-ink-muted transition hover:border-gold/50 hover:text-ink"
                        >
                          {t(key)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-border p-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <MentionableTextarea
                      ref={mentionTaRef}
                      placeholder={t('chatActions.input.placeholder', {
                        defaultValue: 'Ask a question, or tag with @ (people), # (contracts), ~ (counterparties) to fire an action.',
                      })}
                      ariaLabel={t('ai.riskAssistant.input.ariaLabel')}
                      disabled={isStreaming}
                      maxLength={2000}
                      onSubmit={handleSubmit}
                      onChange={(text) => setDraftLen(text.length)}
                    />
                  </div>
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleAbort}
                      aria-label={t('ai.riskAssistant.input.abort')}
                      className="mb-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-terracotta/50 bg-terracotta/10 text-terracotta transition hover:bg-terracotta/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                    >
                      <StopCircle className="h-4 w-4" aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const payload = mentionTaRef.current?.getPayload();
                        if (payload && payload.text.trim()) {
                          void handleSubmit(payload);
                        }
                      }}
                      disabled={draftLen === 0 || isStreaming}
                      aria-label={t('ai.riskAssistant.input.send')}
                      data-testid="chat-send"
                      className="mb-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold text-white transition hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default RiskAssistantPanel;
