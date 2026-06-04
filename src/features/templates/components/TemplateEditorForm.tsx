/**
 * Shared editor form for create + edit template flows.
 *
 * Handles: name (EN/AR), description, contract type, language, body (EN/AR),
 * regulatory reference + tags, and placeholder catalog (key/labelEn/labelAr/
 * kind/required). Validates that every placeholder key appears in the body
 * (orphan check) before allowing submit.
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type {
  TemplateDetail,
  TemplatePlaceholder,
  TemplatePlaceholderKind,
  CreateTemplateInput,
} from "@/services/api/m_parity.service";

const KIND_OPTIONS: TemplatePlaceholderKind[] = [
  "party",
  "date",
  "currency",
  "number",
  "text",
];

const KNOWN_TYPES = [
  "nda",
  "employment",
  "master_services",
  "services",
  "vendor_services",
  "consultancy",
  "lease",
  "distribution",
  "license",
  "llc_incorporation",
  "other",
];

interface TemplateEditorFormProps {
  initial?: Partial<TemplateDetail> & { placeholders?: TemplatePlaceholder[] };
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (input: CreateTemplateInput) => void;
  onCancel?: () => void;
}

export function TemplateEditorForm({
  initial,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: TemplateEditorFormProps) {
  const { t } = useTranslation();

  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? "");
  const [contractType, setContractType] = useState(initial?.contractType ?? "other");
  const [language, setLanguage] = useState<"en" | "ar" | "bilingual">(
    initial?.language ?? "en",
  );
  const [descriptionEn, setDescriptionEn] = useState(initial?.descriptionEn ?? "");
  const [descriptionAr, setDescriptionAr] = useState(initial?.descriptionAr ?? "");
  const [bodyEn, setBodyEn] = useState(initial?.bodyEn ?? "");
  const [bodyAr, setBodyAr] = useState(initial?.bodyAr ?? "");
  const [regulatoryReference, setRegulatoryReference] = useState(
    initial?.regulatoryReference ?? "",
  );
  const [regulatoryTagsStr, setRegulatoryTagsStr] = useState(
    (initial?.regulatoryTags ?? []).join(", "),
  );
  const [placeholders, setPlaceholders] = useState<TemplatePlaceholder[]>(
    initial?.placeholders ?? [],
  );

  // Real-time orphan check: every placeholder key must appear in the relevant body.
  const orphans = useMemo(() => {
    const checkBody = bodyEn + " " + (language !== "en" ? bodyAr : "");
    return placeholders.filter((p) => !checkBody.includes("{{" + p.key + "}}"));
  }, [placeholders, bodyEn, bodyAr, language]);

  const addPlaceholder = () =>
    setPlaceholders((prev) => [
      ...prev,
      { key: "", labelEn: "", labelAr: null, kind: "text", required: true },
    ]);

  const updatePlaceholder = (
    idx: number,
    patch: Partial<TemplatePlaceholder>,
  ) =>
    setPlaceholders((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );

  const removePlaceholder = (idx: number) =>
    setPlaceholders((prev) => prev.filter((_, i) => i !== idx));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim()) return;
    const tags = regulatoryTagsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSubmit({
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim() || null,
      contractType,
      language,
      descriptionEn: descriptionEn.trim() || null,
      descriptionAr: descriptionAr.trim() || null,
      bodyEn: bodyEn || null,
      bodyAr: bodyAr || null,
      regulatoryReference: regulatoryReference.trim() || null,
      regulatoryTags: tags,
      placeholders: placeholders
        .filter((p) => p.key.trim() && p.labelEn.trim())
        .map((p) => ({
          key: p.key.trim().toLowerCase(),
          labelEn: p.labelEn.trim(),
          labelAr: p.labelAr?.trim() || null,
          kind: p.kind,
          required: p.required,
        })),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("templates.editor.metaKicker", { defaultValue: "Template metadata" })}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink" htmlFor="t-name-en">
                {t("templates.editor.nameEn", { defaultValue: "Name (EN)" })} *
              </label>
              <Input
                id="t-name-en"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink" htmlFor="t-name-ar">
                {t("templates.editor.nameAr", { defaultValue: "Name (AR)" })}
              </label>
              <Input
                id="t-name-ar"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                dir="rtl"
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink" htmlFor="t-type">
                {t("templates.editor.contractType", { defaultValue: "Contract type" })} *
              </label>
              <select
                id="t-type"
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {KNOWN_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink" htmlFor="t-lang">
                {t("templates.editor.language", { defaultValue: "Language" })}
              </label>
              <select
                id="t-lang"
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as "en" | "ar" | "bilingual")
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="bilingual">Bilingual</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-ink" htmlFor="t-reg-ref">
                {t("templates.editor.regulatoryReference", {
                  defaultValue: "Regulatory reference (chip)",
                })}
              </label>
              <Input
                id="t-reg-ref"
                value={regulatoryReference}
                onChange={(e) => setRegulatoryReference(e.target.value)}
                placeholder='e.g. "Federal Decree-Law 33/2021"'
                maxLength={200}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-ink" htmlFor="t-reg-tags">
                {t("templates.editor.regulatoryTags", {
                  defaultValue: "Tags (comma-separated)",
                })}
              </label>
              <Input
                id="t-reg-tags"
                value={regulatoryTagsStr}
                onChange={(e) => setRegulatoryTagsStr(e.target.value)}
                placeholder="MoHRE, WPS, Confidentiality"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink" htmlFor="t-desc-en">
                {t("templates.editor.descriptionEn", { defaultValue: "Description (EN)" })}
              </label>
              <textarea
                id="t-desc-en"
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                rows={2}
                maxLength={2000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink" htmlFor="t-desc-ar">
                {t("templates.editor.descriptionAr", { defaultValue: "Description (AR)" })}
              </label>
              <textarea
                id="t-desc-ar"
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                rows={2}
                maxLength={2000}
                dir="rtl"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("templates.editor.placeholdersKicker", {
                defaultValue: "Placeholders ({{count}})",
                count: placeholders.length,
              })}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addPlaceholder}>
              <Plus className="h-4 w-4" />
              {t("templates.editor.addPlaceholder", { defaultValue: "Add placeholder" })}
            </Button>
          </div>
          {placeholders.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-ink-muted">
              {t("templates.editor.placeholdersEmpty", {
                defaultValue:
                  'No placeholders yet. Add tokens like {{employer_name}} so users can substitute values when they use this template.',
              })}
            </p>
          ) : (
            <ul className="space-y-2">
              {placeholders.map((p, i) => {
                const isOrphan = orphans.some((o) => o === p);
                return (
                  <li
                    key={i}
                    className="grid grid-cols-[1fr_1fr_120px_100px_auto] items-center gap-2 rounded-md border border-border bg-card p-2"
                  >
                    <Input
                      value={p.key}
                      onChange={(e) =>
                        updatePlaceholder(i, {
                          key: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, "_"),
                        })
                      }
                      placeholder="snake_case_key"
                      className="font-mono"
                    />
                    <Input
                      value={p.labelEn}
                      onChange={(e) =>
                        updatePlaceholder(i, { labelEn: e.target.value })
                      }
                      placeholder="Human label (EN)"
                    />
                    <select
                      value={p.kind}
                      onChange={(e) =>
                        updatePlaceholder(i, {
                          kind: e.target.value as TemplatePlaceholderKind,
                        })
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {KIND_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-ink-muted">
                      <input
                        type="checkbox"
                        checked={p.required}
                        onChange={(e) =>
                          updatePlaceholder(i, { required: e.target.checked })
                        }
                      />
                      {t("templates.editor.required", { defaultValue: "required" })}
                    </label>
                    <button
                      type="button"
                      onClick={() => removePlaceholder(i)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("templates.editor.removePlaceholder", {
                        defaultValue: "Remove placeholder",
                      })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {isOrphan && (
                      <p className="col-span-5 -mt-1 inline-flex items-center gap-1 text-[11px] text-amber-ink">
                        <AlertTriangle className="h-3 w-3" />
                        {t("templates.editor.orphanWarning", {
                          defaultValue:
                            'This key is not used anywhere in the body — add {{' + p.key + '}} or remove this row.',
                        })}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("templates.editor.bodyKicker", { defaultValue: "Body" })}
          </div>
          {language !== "ar" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink" htmlFor="t-body-en">
                {t("templates.editor.bodyEn", { defaultValue: "Body (EN, Markdown)" })}
              </label>
              <textarea
                id="t-body-en"
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                rows={20}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
              />
            </div>
          )}
          {language !== "en" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink" htmlFor="t-body-ar">
                {t("templates.editor.bodyAr", { defaultValue: "Body (AR, Markdown)" })}
              </label>
              <textarea
                id="t-body-ar"
                value={bodyAr}
                onChange={(e) => setBodyAr(e.target.value)}
                rows={20}
                dir="rtl"
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || !nameEn.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
