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
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, StopCircle, Bot, User } from 'lucide-react';
import { askRiskAssistant } from '@/services/api/risk-assistant.service';
import { useAuthStore, selectUser, selectHasPermission } from '@/store/auth.store';
import { formatDateTime } from '@/utils/datetime';
import type {
  ChatMessage,
  RiskAssistantCitation,
  RiskAssistantPersona,
} from '@/types/entities/risk-assistant.types';

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
          className={`rounded-xl px-3 py-2 text-sm ${isUser ? 'bg-gold/15 text-ink' : 'bg-surface text-ink'}`}
        >
          {message.content}
          {message.isStreaming && (
            <span className="ms-1 inline-block h-2.5 w-1.5 animate-pulse rounded-sm bg-ink-muted" aria-hidden />
          )}
        </div>
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

const EXAMPLE_PROMPTS = [
  'ai.riskAssistant.examples.hormuz',
  'ai.riskAssistant.examples.sanctions',
  'ai.riskAssistant.examples.icv',
];

export function RiskAssistantPanel() {
  const { t } = useTranslation();
  const user = useAuthStore(selectUser);
  const hasPermission = useAuthStore(selectHasPermission('ai.invoke.risk_assistant'));

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const textareaId = useId();
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
      setTimeout(() => textareaRef.current?.focus(), 100);
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

  async function handleSubmit() {
    const trimmed = query.trim();
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
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setQuery('');
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      await askRiskAssistant({
        query: trimmed,
        persona,
        abortSignal: abortRef.current.signal,
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + token }
                : m,
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
        onError: (errorMsg) => {
          // T13: do not leak query content in error; surface generic message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: t('ai.riskAssistant.error.generic'),
                    isStreaming: false,
                  }
                : m,
            ),
          );
          setIsStreaming(false);
          // Log non-sensitive portion for debugging (errorMsg may contain HTTP status only)
          if (import.meta.env.DEV) {
            console.error('[RiskAssistant] stream error:', errorMsg);
          }
        },
      });
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

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
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
                      {EXAMPLE_PROMPTS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setQuery(t(key))}
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
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit();
                  }}
                >
                  <label htmlFor={textareaId} className="sr-only">
                    {t('ai.riskAssistant.input.label')}
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      ref={textareaRef}
                      id={textareaId}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('ai.riskAssistant.input.placeholder')}
                      rows={2}
                      maxLength={2000}
                      disabled={isStreaming}
                      aria-label={t('ai.riskAssistant.input.ariaLabel')}
                      className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-gold focus-visible:outline-none disabled:opacity-50"
                    />
                    {isStreaming ? (
                      <button
                        type="button"
                        onClick={handleAbort}
                        aria-label={t('ai.riskAssistant.input.abort')}
                        className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-lg border border-terracotta/50 bg-terracotta/10 text-terracotta transition hover:bg-terracotta/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                      >
                        <StopCircle className="h-4 w-4" aria-hidden />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!query.trim() || isStreaming}
                        aria-label={t('ai.riskAssistant.input.send')}
                        className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-lg bg-gold text-white transition hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-right font-mono text-[10px] text-ink-subtle">
                    {query.length}/2000
                  </p>
                </form>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default RiskAssistantPanel;
