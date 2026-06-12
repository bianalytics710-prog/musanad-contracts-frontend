/**
 * MentionChip — display-only pill for the @/#/~ mention markup.
 *
 * Used inside MentionableTextarea (a non-editable overlay over the textarea)
 * and inside rendered chat bubbles (parsed from @[Label](kind:id) markup) and
 * inside ProposalCard param tables.
 */
import type { MentionKind } from '@/types/entities/chat-orchestrator.types';

interface Props {
  kind: MentionKind;
  label: string;
  isProspect?: boolean;
  className?: string;
}

const KIND_STYLES: Record<MentionKind, string> = {
  user: 'bg-gold/15 text-ink border-gold/40',
  contract: 'bg-sage/15 text-ink border-sage/40 font-mono',
  party: 'bg-terracotta/15 text-ink border-terracotta/40',
  prospect: 'bg-terracotta/10 text-ink border-terracotta/50 border-dashed',
};

const KIND_PREFIX: Record<MentionKind, string> = {
  user: '@',
  contract: '#',
  party: '~',
  prospect: '~',
};

export function MentionChip({ kind, label, isProspect, className = '' }: Props) {
  const effectiveKind: MentionKind = isProspect ? 'prospect' : kind;
  const styles = KIND_STYLES[effectiveKind];
  const prefix = KIND_PREFIX[effectiveKind];
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 rounded border px-1.5 py-0.5 text-[12px] leading-tight ${styles} ${className}`}
      data-kind={effectiveKind}
    >
      <span aria-hidden className="text-ink-muted">{prefix}</span>
      <span>{label}</span>
    </span>
  );
}

/**
 * Parse the @[Label](kind:id) markup format and yield text + chip segments
 * for rendering inside chat bubbles or proposal previews.
 */
export interface ParsedSegment {
  type: 'text' | 'chip';
  text?: string;
  kind?: MentionKind;
  label?: string;
  refId?: number | null;
}

const MENTION_RE = /([@#~])\[([^\]]+)\]\((user|contract|party|prospect):([^)]+)\)/g;

export function parseMentionMarkup(input: string): ParsedSegment[] {
  if (!input) return [{ type: 'text', text: '' }];
  const out: ParsedSegment[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(input)) !== null) {
    if (m.index > lastIdx) {
      out.push({ type: 'text', text: input.slice(lastIdx, m.index) });
    }
    const kind = m[3] as MentionKind;
    const refIdRaw = m[4];
    const refId = refIdRaw && refIdRaw !== '_' && Number.isFinite(Number(refIdRaw)) ? Number(refIdRaw) : null;
    out.push({ type: 'chip', kind, label: m[2], refId });
    lastIdx = MENTION_RE.lastIndex;
  }
  if (lastIdx < input.length) {
    out.push({ type: 'text', text: input.slice(lastIdx) });
  }
  return out;
}

/** Render a string containing mention markup as React nodes (chip + text). */
export function RenderedMentionText({ text }: { text: string }) {
  const segments = parseMentionMarkup(text);
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === 'text') return <span key={i}>{s.text}</span>;
        if (s.kind && s.label) {
          return (
            <MentionChip
              key={i}
              kind={s.kind}
              label={s.label}
              isProspect={s.kind === 'prospect'}
              className="mx-0.5"
            />
          );
        }
        return null;
      })}
    </>
  );
}
