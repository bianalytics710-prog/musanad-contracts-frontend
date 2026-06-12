/**
 * MentionDropdown — typeahead dropdown shown below the caret while typing
 * @user / #contract / ~party.
 *
 * Pure display + keyboard handler — fetch lives in MentionableTextarea.
 * Portal-rendered so the panel's overflow:hidden doesn't clip it.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MentionKind, MentionTypeaheadRow } from '@/types/entities/chat-orchestrator.types';

interface Props {
  open: boolean;
  loading: boolean;
  kind: MentionKind | null;
  results: MentionTypeaheadRow[];
  activeIndex: number;
  position: { bottom: number; left: number } | null;
  onPick: (row: MentionTypeaheadRow) => void;
  onHover: (index: number) => void;
}

const KIND_HINT: Record<MentionKind, string> = {
  user: 'people',
  contract: 'contracts',
  party: 'counterparties',
  prospect: 'counterparties',
};

export function MentionDropdown({
  open,
  loading,
  kind,
  results,
  activeIndex,
  position,
  onPick,
  onHover,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  if (!open || !position || !kind) return null;

  const node = (
    <div
      role="listbox"
      aria-label={`Mention ${KIND_HINT[kind]}`}
      ref={listRef}
      style={{ position: 'fixed', bottom: position.bottom, left: position.left, zIndex: 1000 }}
      className="w-72 max-h-72 overflow-y-auto rounded-md border border-border bg-card shadow-lg"
    >
      <div className="border-b border-border bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
        {KIND_HINT[kind]}
      </div>
      {loading && (
        <div className="px-3 py-2 text-xs text-ink-muted">Searching…</div>
      )}
      {!loading && results.length === 0 && (
        <div className="px-3 py-2 text-xs text-ink-muted">No matches.</div>
      )}
      {!loading &&
        results.map((row, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              type="button"
              key={`${row.id ?? 'prospect'}-${idx}`}
              data-idx={idx}
              role="option"
              aria-selected={isActive}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(row);
              }}
              onMouseEnter={() => onHover(idx)}
              className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs ${
                isActive ? 'bg-gold/10 text-ink' : 'text-ink'
              } ${row.isProspect ? 'border-t border-dashed border-border italic' : ''}`}
            >
              <div className="flex-1">
                <div className={row.isProspect ? 'text-terracotta' : 'font-medium'}>{row.label}</div>
                {row.subLabel && (
                  <div className="text-[10px] text-ink-muted">{row.subLabel}</div>
                )}
              </div>
            </button>
          );
        })}
    </div>
  );
  return createPortal(node, document.body);
}
