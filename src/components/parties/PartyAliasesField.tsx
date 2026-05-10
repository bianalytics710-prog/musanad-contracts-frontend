/**
 * PartyAliasesField — multi-input chip-list editor for party.aliases.
 *
 * Used by PartyExtendedEditDialog. Type / paste / press Enter (or comma) to
 * add. Backspace on empty input removes the last chip. Pencils blank values
 * out before passing to onChange so the persisted JSONB array never contains
 * empty strings (db-design §3.4: every element must be a non-empty string).
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface PartyAliasesFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** When true, the field is read-only — no add/remove. */
  disabled?: boolean;
  /** Override the default htmlFor / id (D6). */
  inputId?: string;
}

export function PartyAliasesField({
  value,
  onChange,
  disabled,
  inputId,
}: PartyAliasesFieldProps) {
  const { t } = useTranslation();
  const reactId = useId();
  const id = inputId ?? `aliases-${reactId}`;
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;
    if (value.includes(trimmed)) return; // dedupe
    onChange([...value, trimmed]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft.length === 0 && value.length > 0) {
      e.preventDefault();
      remove(value.length - 1);
    }
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted"
      >
        {t("parties.aliases.title")}
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {value.map((alias, idx) => (
          <span
            key={`${alias}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs text-ink"
          >
            <span className="max-w-[180px] truncate">{alias}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-full p-0.5 text-ink-muted hover:bg-card hover:text-terracotta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("parties.aliases.remove", { alias })}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            )}
          </span>
        ))}
        <Input
          id={id}
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          disabled={disabled}
          placeholder={
            value.length === 0
              ? t("parties.aliases.empty")
              : t("parties.aliases.addAlias")
          }
          className="h-7 w-32 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
        {!disabled && draft.trim().length > 0 && (
          <button
            type="button"
            onClick={() => commit(draft)}
            className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold hover:bg-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("parties.aliases.addAlias")}
          >
            <Plus className="h-3 w-3" aria-hidden />
            {t("common.add", { defaultValue: "Add" })}
          </button>
        )}
      </div>
      <p className="mt-1 text-[10px] text-ink-subtle">
        {t("parties.aliases.help")}
      </p>
    </div>
  );
}
