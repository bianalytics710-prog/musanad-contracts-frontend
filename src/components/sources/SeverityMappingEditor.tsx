/**
 * SeverityMappingEditor — JSON / form hybrid editor for the SeverityMapping
 * JSONB shape. Two modes:
 *   "form" — guided builder (one row per rule, choose conditions + severity)
 *   "raw"  — JSON textarea editor (for power users / fixtures)
 *
 * Round-trips between modes when the JSON is valid; reports a parse error
 * when it isn't. The wrapping form decides whether to send the value.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Severity,
  SeverityMapping,
  SeverityMappingRule,
} from "@/types/entities/osint.types";

const SEVERITIES: Severity[] = [
  "informational",
  "low",
  "medium",
  "high",
  "critical",
];

interface SeverityMappingEditorProps {
  idPrefix: string;
  value: SeverityMapping | null;
  onChange: (next: SeverityMapping | null) => void;
  disabled?: boolean;
}

export function SeverityMappingEditor({
  idPrefix,
  value,
  onChange,
  disabled,
}: SeverityMappingEditorProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"form" | "raw">("form");
  const [rawText, setRawText] = useState<string>(
    () => JSON.stringify(value ?? { rules: [] }, null, 2),
  );
  const [rawError, setRawError] = useState<string | null>(null);

  const rules: SeverityMappingRule[] = value?.rules ?? [];

  const updateRule = (idx: number, patch: Partial<SeverityMappingRule>) => {
    const next = rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange({ rules: next });
  };

  const addRule = () => {
    const next: SeverityMappingRule[] = [...rules, { severity: "medium" }];
    onChange({ rules: next });
  };

  const removeRule = (idx: number) => {
    const next = rules.filter((_, i) => i !== idx);
    onChange(next.length === 0 ? null : { rules: next });
  };

  const switchToRaw = () => {
    setRawText(JSON.stringify(value ?? { rules: [] }, null, 2));
    setRawError(null);
    setMode("raw");
  };

  const switchToForm = () => {
    try {
      const parsed = JSON.parse(rawText) as SeverityMapping;
      if (!parsed || !Array.isArray(parsed.rules)) {
        throw new Error(
          t("admin.sources.form.severityMapping.invalidShape", {
            defaultValue: "Mapping must be { rules: [...] }",
          }),
        );
      }
      onChange(parsed);
      setRawError(null);
      setMode("form");
    } catch (err) {
      setRawError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <fieldset className="grid gap-3 rounded-md border border-border bg-surface/30 p-3">
      <legend className="flex items-center justify-between gap-2 px-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          {t("admin.sources.form.severityMapping.label", {
            defaultValue: "Severity mapping",
          })}
        </span>
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-wider text-gold hover:underline"
          onClick={mode === "form" ? switchToRaw : switchToForm}
          disabled={disabled}
        >
          {mode === "form"
            ? t("admin.sources.form.severityMapping.editRaw", {
                defaultValue: "Edit raw JSON",
              })
            : t("admin.sources.form.severityMapping.editForm", {
                defaultValue: "Switch to form",
              })}
        </button>
      </legend>

      {mode === "form" ? (
        <div className="space-y-2">
          {rules.length === 0 ? (
            <p className="text-xs text-ink-muted">
              {t("admin.sources.form.severityMapping.empty", {
                defaultValue: "No rules. Add the first rule below.",
              })}
            </p>
          ) : null}
          {rules.map((rule, idx) => {
            const baseId = `${idPrefix}-rule-${idx}`;
            return (
              <div
                key={idx}
                className="grid gap-2 rounded border border-border bg-card p-2 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <div className="space-y-1">
                  <Label htmlFor={`${baseId}-titleContains`} className="text-[10px]">
                    {t("admin.sources.form.severityMapping.titleContains", {
                      defaultValue: "Title contains",
                    })}
                  </Label>
                  <Input
                    id={`${baseId}-titleContains`}
                    value={rule.titleContains ?? ""}
                    onChange={(e) =>
                      updateRule(idx, {
                        titleContains: e.target.value || undefined,
                      })
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${baseId}-programContains`} className="text-[10px]">
                    {t("admin.sources.form.severityMapping.programContains", {
                      defaultValue: "Program contains",
                    })}
                  </Label>
                  <Input
                    id={`${baseId}-programContains`}
                    value={rule.programContains ?? ""}
                    onChange={(e) =>
                      updateRule(idx, {
                        programContains: e.target.value || undefined,
                      })
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${baseId}-severity`} className="text-[10px]">
                    {t("admin.sources.form.severityMapping.severity", {
                      defaultValue: "Severity",
                    })}
                  </Label>
                  <select
                    id={`${baseId}-severity`}
                    className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                    value={rule.severity ?? rule.default ?? "medium"}
                    onChange={(e) =>
                      updateRule(idx, {
                        severity: e.target.value as Severity,
                      })
                    }
                    disabled={disabled}
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {t(`admin.sources.severity.${s}`, { defaultValue: s })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("admin.sources.form.severityMapping.remove", {
                      defaultValue: "Remove rule",
                    })}
                    onClick={() => removeRule(idx)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addRule}
            disabled={disabled}
          >
            <Plus className="me-2 h-3.5 w-3.5" />
            {t("admin.sources.form.severityMapping.add", {
              defaultValue: "Add rule",
            })}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label
            htmlFor={`${idPrefix}-raw`}
            className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
          >
            {t("admin.sources.form.severityMapping.rawHint", {
              defaultValue: "Raw JSON ({ rules: [...] })",
            })}
          </Label>
          <textarea
            id={`${idPrefix}-raw`}
            className="min-h-[160px] w-full rounded-md border border-border bg-card p-2 font-mono text-xs"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={disabled}
          />
          {rawError ? (
            <p className="text-xs text-terracotta">{rawError}</p>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}
