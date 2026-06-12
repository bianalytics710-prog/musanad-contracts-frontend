/**
 * MentionableTextarea — multi-line textarea with @user / #contract / ~party
 * mention chips.
 *
 * Design choice: plain HTML <textarea> + a positioned MentionDropdown.
 * Inside the textarea we store markdown-style markup —
 *
 *   "Draft a similar contract for ~[Vibrant](party:13) for @[Hala](user:5) based on #[CT-2026-000028](contract:42)."
 *
 * On submit we serialise to `{ text, mentions[] }` for the BE. Keeps the
 * implementation tiny (no contenteditable, no third-party library) and
 * full keyboard-/screen-reader-accessible because <textarea> is native.
 *
 * Trade-off: chips render visually only inside the rendered chat bubble
 * AFTER send, not while editing. We do show the typed `@hal` part inline
 * during the typeahead — once picked, it becomes `@[Hala Al Marri](user:5)`
 * inside the textarea. To reduce visual noise, we colour-tag those tokens
 * by overlaying a fixed-position "preview" line under the textarea.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { MentionDropdown } from './MentionDropdown';
import { chatMentionsService } from '@/services/api/chat-mentions.service';
import type {
  ChatMention,
  MentionKind,
  MentionTypeaheadResponse,
  MentionTypeaheadRow,
} from '@/types/entities/chat-orchestrator.types';

const TRIGGER_TO_KIND: Record<string, MentionKind> = {
  '@': 'user',
  '#': 'contract',
  '~': 'party',
};

interface ActiveTrigger {
  kind: MentionKind;
  start: number;
  query: string;
}

export interface MentionableTextareaHandle {
  /** Focus the textarea. */
  focus: () => void;
  /** Read current value + mention array. */
  getPayload: () => { text: string; mentions: ChatMention[] };
  /** Reset to empty. */
  clear: () => void;
  /** Imperatively set raw text (mentions are auto-derived from any markup). */
  setText: (next: string) => void;
}

interface Props {
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  onSubmit: (payload: { text: string; mentions: ChatMention[] }) => void;
  /** Optional change callback if parent wants to drive sample prompts. */
  onChange?: (text: string) => void;
}

export const MentionableTextarea = forwardRef<MentionableTextareaHandle, Props>(function MentionableTextarea(
  { placeholder, ariaLabel, disabled, rows = 2, maxLength = 4000, onSubmit, onChange },
  ref,
) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<ChatMention[]>([]);

  const [active, setActive] = useState<ActiveTrigger | null>(null);
  const [results, setResults] = useState<MentionTypeaheadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [position, setPosition] = useState<{ bottom: number; left: number } | null>(null);

  const debounceRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setText('');
    setMentions([]);
    setActive(null);
    setResults([]);
    setActiveIdx(0);
    setPosition(null);
    onChange?.('');
  }, [onChange]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => taRef.current?.focus(),
      getPayload: () => ({ text, mentions }),
      clear: reset,
      setText: (next: string) => {
        setText(next);
        onChange?.(next);
      },
    }),
    [text, mentions, reset, onChange],
  );

  // ─── Detect active trigger by scanning back from cursor ───────────────
  const detectTrigger = useCallback(
    (value: string, cursor: number): ActiveTrigger | null => {
      // Walk back from cursor until we hit whitespace or string start.
      for (let i = cursor - 1; i >= 0; i--) {
        const ch = value[i];
        if (ch === undefined) return null;
        if (TRIGGER_TO_KIND[ch] !== undefined) {
          // Must be preceded by whitespace or start-of-string OR right after a `]` marker boundary.
          const prev = i > 0 ? value[i - 1] : undefined;
          if (prev !== undefined && !/[\s\(]/.test(prev)) return null;
          // Disallow if the trigger appears inside an already-completed `[ ]( )` markup region.
          // Lightweight heuristic: if there's an unclosed `[` to the right of `i` and before cursor, bail.
          const between = value.slice(i + 1, cursor);
          if (/[\[\]\(\)]/.test(between)) return null;
          return {
            kind: TRIGGER_TO_KIND[ch]!,
            start: i,
            query: between,
          };
        }
        if (/\s/.test(ch)) return null;
      }
      return null;
    },
    [],
  );

  // ─── Fetch dropdown results when active trigger changes ──────────────
  useEffect(() => {
    if (!active) {
      setResults([]);
      return;
    }
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        let resp: MentionTypeaheadResponse;
        if (active.kind === 'user') {
          resp = await chatMentionsService.searchUsers(active.query, 8);
        } else if (active.kind === 'contract') {
          resp = await chatMentionsService.searchContracts(active.query, 8);
        } else {
          resp = await chatMentionsService.searchParties(active.query, 8);
        }
        setResults(resp.results);
        setActiveIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [active]);

  // ─── Position dropdown directly above the textarea ────────────────────
  // Bottom-anchored: the dropdown's BOTTOM edge sits just above the
  // textarea's top edge, so the dropdown grows upward and stays visually
  // attached regardless of how many rows it renders.
  const recomputePosition = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const rect = ta.getBoundingClientRect();
    setPosition({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
  }, []);

  const handleInput = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      setText(v);
      onChange?.(v);
      const cursor = e.target.selectionStart ?? v.length;
      const trig = detectTrigger(v, cursor);
      if (trig) {
        setActive(trig);
        recomputePosition();
      } else {
        setActive(null);
      }
    },
    [detectTrigger, onChange, recomputePosition],
  );

  const insertMention = useCallback(
    (row: MentionTypeaheadRow) => {
      if (!active) return;
      const trig = active;
      const triggerChar = Object.entries(TRIGGER_TO_KIND).find(([, k]) => k === trig.kind)?.[0] ?? '@';
      const ta = taRef.current;
      if (!ta) return;

      const isProspect = !!row.isProspect;
      const refIdStr = isProspect ? '_' : String(row.id);
      const kindForMarkup: MentionKind = isProspect ? 'prospect' : trig.kind;
      const labelForChip = isProspect && row.prospectName ? row.prospectName : row.label;
      const markup = `${triggerChar}[${labelForChip}](${kindForMarkup}:${refIdStr})`;

      const before = text.slice(0, trig.start);
      const after = text.slice(trig.start + 1 + trig.query.length);
      const newText = `${before}${markup} ${after}`;
      setText(newText);
      onChange?.(newText);

      // Append to mentions, dedupe by id.
      const mention: ChatMention = {
        id: `${kindForMarkup}:${refIdStr}`,
        kind: kindForMarkup,
        label: labelForChip,
        refId: isProspect ? null : (typeof row.id === 'number' ? row.id : null),
      };
      setMentions((prev) => {
        const others = prev.filter((m) => m.id !== mention.id);
        return [...others, mention];
      });

      setActive(null);
      setResults([]);
      setActiveIdx(0);

      // Restore focus + caret after inserted markup + space.
      const caretPos = (before + markup + ' ').length;
      setTimeout(() => {
        const t = taRef.current;
        if (t) {
          t.focus();
          t.setSelectionRange(caretPos, caretPos);
        }
      }, 0);
    },
    [active, text, onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (active && results.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIdx((i) => Math.min(i + 1, results.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          const row = results[activeIdx];
          if (row) {
            e.preventDefault();
            insertMention(row);
            return;
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setActive(null);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey && !active) {
        e.preventDefault();
        const payload = { text, mentions };
        if (text.trim().length > 0) {
          onSubmit(payload);
        }
      }
    },
    [active, results, activeIdx, insertMention, text, mentions, onSubmit],
  );

  // Re-position on scroll/resize while dropdown open.
  useEffect(() => {
    if (!active) return;
    const handler = () => recomputePosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [active, recomputePosition]);

  // Trim stale mentions whenever the markup is removed manually.
  useEffect(() => {
    const present = new Set<string>();
    const re = /([@#~])\[([^\]]+)\]\((user|contract|party|prospect):([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const k = m[3] as MentionKind;
      const id = m[4];
      present.add(`${k}:${id}`);
    }
    setMentions((prev) => prev.filter((mn) => present.has(mn.id)));
  }, [text]);

  // Char count for the small footer.
  const charCount = text.length;
  const charMax = maxLength;
  const charLabel = useMemo(() => `${charCount}/${charMax}`, [charCount, charMax]);

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        spellCheck
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-gold focus-visible:outline-none disabled:opacity-50"
      />
      <div className="mt-1 text-right font-mono text-[10px] text-ink-subtle">{charLabel}</div>
      <MentionDropdown
        open={!!active}
        loading={loading}
        kind={active?.kind ?? null}
        results={results}
        activeIndex={activeIdx}
        position={position}
        onPick={insertMention}
        onHover={setActiveIdx}
      />
    </div>
  );
});
