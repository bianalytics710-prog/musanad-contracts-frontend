/**
 * ContractTagsEditor (S8) — chip-input editor for the contract.tags set.
 *
 * Mode: harden — chip-input pattern adapted from the Lovable TagsField slice
 * (the Lovable version was deeply embedded in the contracts list bulk-tag
 * dialog; this is the contract-detail per-row editor).
 *
 * AC mapping:
 *   AC-S8-01..03 — PUT /api/v1/contracts/:id/tags with the full set.
 *                  Empty array clears all tags.
 *   AC-S8-05     — client length check 1..64; server is the source of truth.
 *   AC-S8-06     — control-character check on submit.
 *
 * Behaviour: edit-in-place; user types tags, presses Enter or comma to add,
 * clicks the X to remove. Save dispatches the full new set to the BE.
 */
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSetContractTags } from "@/features/contracts/hooks/useContracts";

interface ContractTagsEditorProps {
  contractId: number;
  initialTags: string[];
  /** When false, render the chip-set in read-only mode (no input + no remove). */
  editable?: boolean;
}

const MAX_TAG_LENGTH = 64;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR = /[\x00-\x1F\x7F]/;

export function ContractTagsEditor({
  contractId,
  initialTags,
  editable = true,
}: ContractTagsEditorProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  const isDirty = useMemo(() => {
    if (tags.length !== initialTags.length) return true;
    const a = [...tags].sort();
    const b = [...initialTags].sort();
    return a.some((v, i) => v !== b[i]);
  }, [tags, initialTags]);

  const mutation = useSetContractTags({
    onSuccess: (resp) => {
      setTags(resp.tags);
    },
  });

  const validateTag = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_TAG_LENGTH) {
      return t("contracts.tags.errors.length");
    }
    if (CONTROL_CHAR.test(trimmed)) {
      return t("contracts.tags.errors.control");
    }
    return null;
  };

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") return;
    const err = validateTag(trimmed);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (!tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t2) => t2 !== tag));
    setError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      // Quick-remove last tag when input is empty (CSS chip-input pattern).
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleSave = () => {
    setError(null);
    for (const tag of tags) {
      const err = validateTag(tag);
      if (err) {
        setError(err);
        return;
      }
    }
    mutation.mutate({ id: contractId, data: { tags } });
  };

  const handleCancel = () => {
    setTags(initialTags);
    setInput("");
    setError(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent p-2 min-h-[2.5rem]">
        {tags.length === 0 && !editable && (
          <span className="text-xs text-ink-subtle">{t("contracts.tags.empty")}</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink"
          >
            {tag}
            {editable && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={mutation.isPending}
                className="rounded-full p-0.5 text-ink-subtle transition hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={t("contracts.tags.removeAria", { tag })}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {editable && (
          <>
            <label htmlFor={inputId} className="sr-only">
              {t("contracts.tags.inputLabel")}
            </label>
            <Input
              id={inputId}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => addTag(input)}
              placeholder={t("contracts.tags.placeholder")}
              disabled={mutation.isPending}
              className="h-7 flex-1 min-w-[120px] border-0 px-1 shadow-none focus-visible:ring-0"
              maxLength={MAX_TAG_LENGTH}
            />
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[11px] font-medium text-destructive">
          {error}
        </p>
      )}

      {editable && (
        <div className="flex justify-end gap-2">
          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={mutation.isPending}
            >
              {t("common.cancel")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || mutation.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            {mutation.isPending ? t("common.saving") : t("contracts.tags.save")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ContractTagsEditor;
