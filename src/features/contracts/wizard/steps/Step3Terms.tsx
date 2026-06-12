/**
 * Step3Terms — Compose Wizard Step 3 (Clauses & Body).
 *
 * Compose-revamp v2 2026-06-03 — the body preview is now the FULL template
 * document (preamble + every `## N.` section + signature) with placeholders
 * substituted live from Step 2. Sections come from
 * parseTemplateBodyBilingual(activeTemplate.bodyEn, activeTemplate.bodyAr).
 *
 * Layout:
 *   1. Clause library panel (collapsible) — Insert button on each row.
 *      Inserted clauses become new sections appended after the existing
 *      template clauses (before the signature block).
 *   2. Body preview / editor:
 *        - Preamble (locked, substituted, highlighted)
 *        - Clauses (drag-reorder + remove, substituted, highlighted)
 *        - Signature (locked, substituted, highlighted)
 *      EN ↔ AR toggle visible only for bilingual templates.
 *
 * T13: editor state is in-memory only. The wizard parent clears the
 * sensitive bodies on unmount (FE-C1 pattern, unchanged).
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  BookText,
  Search,
  GripVertical,
  X as XIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Plus,
  Lock,
  Pencil,
  Check,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";
import { clausesService } from "@/services/api/m_parity.service";
import { assembleBodyFromSections } from "../template-body-parser";
import type {
  ComposeWizardStep3ClausesBody,
  ComposeBodySection,
} from "@/types/entities/payment-schedule.types";

interface Step3TermsProps {
  value: ComposeWizardStep3ClausesBody;
  onChange: (next: ComposeWizardStep3ClausesBody) => void;
  disabled?: boolean;
  /** Step 2 placeholder values for live `{{token}}` → value substitution. */
  placeholderValues?: Record<string, string>;
  /** Contract language — controls the body toggle. */
  contractLanguage?: "en" | "ar" | "bilingual";
  /**
   * IDs of library clauses already covered by the active template (sourced
   * from the contract_template_clause join). Drives the "In template"
   * informational badge in the library so the drafter doesn't double up
   * on coverage. Empty set when no template is selected.
   */
  inTemplateClauseIds?: Set<number>;
}

export function Step3Terms({
  value,
  onChange,
  disabled = false,
  placeholderValues = {},
  contractLanguage = "en",
  inTemplateClauseIds,
}: Step3TermsProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  // ── Sections (parsed body) ────────────────────────────────────────────────
  const [sections, setSections] = useState<ComposeBodySection[]>(value.sections ?? []);

  // ── Language toggle ───────────────────────────────────────────────────────
  const langToggleAvailable = contractLanguage === "bilingual";
  const [bodyLanguage, setBodyLanguage] = useState<"en" | "ar">(
    value.bodyLanguage ?? (contractLanguage === "ar" ? "ar" : "en"),
  );
  useEffect(() => {
    if (!langToggleAvailable) {
      setBodyLanguage(contractLanguage === "ar" ? "ar" : "en");
    }
  }, [contractLanguage, langToggleAvailable]);

  // Push state up to the wizard parent. bodyEn / bodyAr are re-assembled from
  // sections so submit time can write them straight to the BE.
  useEffect(() => {
    onChange({
      bodyEn: assembleBodyFromSections(sections, "en") || null,
      bodyAr: assembleBodyFromSections(sections, "ar") || null,
      sections,
      bodyLanguage,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, bodyLanguage]);

  // ── Clause library ────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const clausesQuery = useQuery({
    queryKey: ["compose-step3-clauses", category, query],
    queryFn: () =>
      clausesService.list({
        category: category || undefined,
        q: query || undefined,
        limit: 80,
      }),
    staleTime: 60_000,
  });
  const clauses = clausesQuery.data?.data ?? [];
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const c of clauses) {
      if (c.category) seen.add(c.category);
    }
    return Array.from(seen).sort();
  }, [clauses]);

  // A library clause is considered "Added" when a section sourced from
  // library already references it. Title-only template sections never count
  // here — the library and the template are independent stacks.
  const addedLibraryClauseIds = useMemo(
    () =>
      new Set(
        sections
          .filter((s) => s.source === "library" && typeof s.clauseId === "number")
          .map((s) => s.clauseId as number),
      ),
    [sections],
  );

  const [insertingId, setInsertingId] = useState<number | null>(null);
  async function insertClause(clauseId: number) {
    if (addedLibraryClauseIds.has(clauseId)) return;
    setInsertingId(clauseId);
    try {
      const detail = await clausesService.getById(clauseId);
      setSections((prev) => {
        const newSection: ComposeBodySection = {
          id: `lib-${clauseId}-${Date.now()}`,
          kind: "clause",
          title: isAr && detail.titleAr ? detail.titleAr : detail.titleEn,
          bodyEn: detail.bodyEn,
          bodyAr: detail.bodyAr,
          source: "library",
          clauseId: detail.id,
        };
        // Insert before the signature block if present, else at the end.
        const sigIdx = prev.findIndex((s) => s.kind === "signature");
        if (sigIdx === -1) return [...prev, newSection];
        return [...prev.slice(0, sigIdx), newSection, ...prev.slice(sigIdx)];
      });
    } finally {
      setInsertingId(null);
    }
  }
  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }
  // 2026-06-11 — drafter can edit each section's title + body inline. A
  // template is just a starting point; the drafter still needs the room to
  // negotiate wording. Saved edits flow into bodyEn/bodyAr at submit via
  // assembleBodyFromSections, so the BE persists exactly what the drafter
  // sees in the preview.
  function updateSection(id: string, patch: Partial<ComposeBodySection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  // ── Drag reorder (clauses only) ──────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      // Preamble + signature are positionally locked. If the user tried to
      // drag a clause past one of them, snap to the boundary.
      const firstClauseIdx = prev.findIndex((s) => s.kind === "clause");
      const lastClauseIdx =
        prev.length - 1 - prev.slice().reverse().findIndex((s) => s.kind === "clause");
      const clampedNew = Math.max(firstClauseIdx, Math.min(lastClauseIdx, newIdx));
      return arrayMove(prev, oldIdx, clampedNew);
    });
  }

  const [libraryOpen, setLibraryOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);

  const clauseSections = sections.filter((s) => s.kind === "clause");

  return (
    <div className="space-y-4">
      {/* Clause library */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <header className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setLibraryOpen((v) => !v)}
              className="flex items-center gap-2 text-left"
              aria-expanded={libraryOpen}
            >
              <BookText className="h-4 w-4 text-gold" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-ink">
                  {t("contracts.compose.steps.step3.clausesTitle", {
                    defaultValue: "Clause library",
                  })}
                </h3>
                <p className="text-xs text-ink-muted">
                  {t("contracts.compose.steps.step3.clausesHelpV2", {
                    defaultValue:
                      "Insert additional clauses into the contract body — they're appended before the signature block.",
                  })}
                </p>
              </div>
            </button>
            {libraryOpen ? (
              <ChevronUp className="h-4 w-4 text-ink-subtle" />
            ) : (
              <ChevronDown className="h-4 w-4 text-ink-subtle" />
            )}
          </header>

          {libraryOpen && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("clauseLibrary.searchPlaceholder", {
                      defaultValue: "Search clauses…",
                    })}
                    disabled={disabled}
                    className="ps-7"
                  />
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={disabled}
                  className={cn(
                    "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  aria-label={t("clauseLibrary.categoryAria", {
                    defaultValue: "Filter by category",
                  })}
                >
                  <option value="">{t("common.all", { defaultValue: "All categories" })}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {humanizeLabel(c)}
                    </option>
                  ))}
                </select>
              </div>

              {clausesQuery.isLoading ? (
                <div className="space-y-1.5" aria-hidden>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-md bg-surface" />
                  ))}
                </div>
              ) : clauses.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-ink-muted">
                  {t("contracts.compose.steps.step3.clausesEmpty", {
                    defaultValue: "No clauses match.",
                  })}
                </p>
              ) : (
                <ul className="max-h-64 space-y-1.5 overflow-y-auto pe-1">
                  {clauses.map((c) => {
                    const title = isAr && c.titleAr ? c.titleAr : c.titleEn;
                    const added = addedLibraryClauseIds.has(c.id);
                    const inTemplate = inTemplateClauseIds?.has(c.id) ?? false;
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "flex items-start justify-between gap-2 rounded-md border bg-surface/40 p-2 text-xs",
                          added
                            ? "border-sage/40 bg-sage/5"
                            : inTemplate
                            ? "border-gold/40 bg-gold/5"
                            : "border-border",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                                c.variant === "standard"
                                  ? "bg-sage/20 text-sage-foreground"
                                  : c.variant === "alternative"
                                  ? "bg-gold/20 text-ink"
                                  : "bg-terracotta/20 text-ink",
                              )}
                            >
                              {humanizeLabel(String(c.variant ?? ""))}
                            </span>
                            <span className="rounded-full bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                              {humanizeLabel(String(c.category ?? ""))}
                            </span>
                            <span className="truncate text-ink">{title}</span>
                          </div>
                        </div>
                        {added ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled
                            className="border-sage/40 text-sage"
                          >
                            {t("contracts.compose.steps.step3.addedBadge", {
                              defaultValue: "Added",
                            })}
                          </Button>
                        ) : inTemplate ? (
                          <span
                            className="inline-flex items-center rounded-md border border-gold/40 bg-gold/15 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink"
                            title={t("contracts.compose.steps.step3.inTemplateTooltip", {
                              defaultValue:
                                "The template body already covers this clause — no need to insert.",
                            })}
                          >
                            {t("contracts.compose.steps.step3.inTemplateBadge", {
                              defaultValue: "In template",
                            })}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={disabled || insertingId === c.id}
                            onClick={() => void insertClause(c.id)}
                          >
                            <Plus className="h-3 w-3" />
                            {insertingId === c.id
                              ? t("contracts.compose.steps.step3.inserting", {
                                  defaultValue: "Inserting…",
                                })
                              : t("contracts.compose.steps.step3.insertCta", {
                                  defaultValue: "Insert",
                                })}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Full body preview — preamble, clauses, signature */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <header className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              className="flex flex-1 items-start gap-2 text-left"
              aria-expanded={previewOpen}
            >
              <Eye className="mt-0.5 h-4 w-4 text-gold" aria-hidden="true" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("contracts.compose.steps.step3.previewKicker", {
                    defaultValue: "Contract preview",
                  })}
                </p>
                <h3 className="mt-0.5 text-base font-semibold text-ink">
                  {t("contracts.compose.steps.step3.previewTitleV2", {
                    defaultValue: "Full contract body",
                  })}
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {t("contracts.compose.steps.step3.previewHelpV3", {
                    defaultValue:
                      "Preamble + every section + signature. Drag the numbered clauses to reorder, or click the pencil to edit any section's wording. Placeholders are substituted live from Step 2.",
                  })}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {langToggleAvailable && (
                <div className="flex rounded-md border border-border bg-card text-[11px]">
                  <button
                    type="button"
                    onClick={() => setBodyLanguage("en")}
                    className={cn(
                      "rounded-l-md px-2 py-1 font-mono uppercase tracking-wider",
                      bodyLanguage === "en"
                        ? "bg-gold/15 text-ink"
                        : "text-ink-subtle hover:bg-surface",
                    )}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setBodyLanguage("ar")}
                    className={cn(
                      "rounded-r-md px-2 py-1 font-mono uppercase tracking-wider",
                      bodyLanguage === "ar"
                        ? "bg-gold/15 text-ink"
                        : "text-ink-subtle hover:bg-surface",
                    )}
                  >
                    AR
                  </button>
                </div>
              )}
              {previewOpen ? (
                <ChevronUp className="h-4 w-4 text-ink-subtle" />
              ) : (
                <ChevronDown className="h-4 w-4 text-ink-subtle" />
              )}
            </div>
          </header>

          {previewOpen && sections.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-xs text-ink-muted">
              {t("contracts.compose.steps.step3.previewEmptyV2", {
                defaultValue: "Pick a template in Step 1 to populate the body.",
              })}
            </p>
          )}

          {previewOpen && sections.length > 0 && (
            <div className="space-y-3">
              {/* Preamble (editable) */}
              {sections
                .filter((s) => s.kind === "preamble")
                .map((s) => (
                  <EditableHeaderSection
                    key={s.id}
                    section={s}
                    language={bodyLanguage}
                    placeholderValues={placeholderValues}
                    onChange={(patch) => updateSection(s.id, patch)}
                    disabled={disabled}
                    labelKey="contracts.compose.steps.step3.preambleLabel"
                    labelDefault="Preamble"
                  />
                ))}

              {/* Clauses (drag-reorder, removable) */}
              {clauseSections.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                    <GripVertical className="h-3 w-3" aria-hidden="true" />
                    {t("contracts.compose.steps.step3.dragHint", {
                      defaultValue: "Drag to reorder clauses",
                    })}
                  </p>
                  <SortableContext
                    items={clauseSections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ol className="space-y-3">
                      {clauseSections.map((s, i) => (
                        <SortableClauseSection
                          key={s.id}
                          section={s}
                          index={i + 1}
                          language={bodyLanguage}
                          placeholderValues={placeholderValues}
                          onRemove={() => removeSection(s.id)}
                          onChange={(patch) => updateSection(s.id, patch)}
                          disabled={disabled}
                        />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              )}

              {/* Signature (editable) */}
              {sections
                .filter((s) => s.kind === "signature")
                .map((s) => (
                  <EditableHeaderSection
                    key={s.id}
                    section={s}
                    language={bodyLanguage}
                    placeholderValues={placeholderValues}
                    onChange={(patch) => updateSection(s.id, patch)}
                    disabled={disabled}
                    labelKey="contracts.compose.steps.step3.signatureLabel"
                    labelDefault="Signature"
                  />
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── EditableHeaderSection (preamble / signature) ────────────────────────────
//
// 2026-06-11 — preamble + signature now editable inline. Drafters need the
// room to negotiate wording on every part of a contract, not just clauses.
// Same Edit/Save/Cancel UX as SortableClauseSection — the only difference is
// no title input (preamble/signature don't carry titles).

function EditableHeaderSection({
  section,
  language,
  placeholderValues,
  onChange,
  disabled,
  labelKey,
  labelDefault,
}: {
  section: ComposeBodySection;
  language: "en" | "ar";
  placeholderValues: Record<string, string>;
  onChange: (patch: Partial<ComposeBodySection>) => void;
  disabled?: boolean;
  labelKey: string;
  labelDefault: string;
}) {
  const { t } = useTranslation();
  const dir = language === "ar" ? "rtl" : "ltr";
  const body = (language === "ar" ? section.bodyAr : section.bodyEn) ?? "";

  const [isEditing, setIsEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(body);
  useEffect(() => {
    // When language toggles while not editing, refresh the textarea seed so
    // entering edit mode shows the right language's body.
    if (!isEditing) setDraftBody(body);
  }, [body, isEditing]);

  const save = () => {
    if (language === "ar") onChange({ bodyAr: draftBody });
    else onChange({ bodyEn: draftBody });
    setIsEditing(false);
  };
  const cancel = () => {
    setDraftBody(body);
    setIsEditing(false);
  };

  return (
    <div className="rounded-md border border-border bg-surface/40 p-3" dir={dir}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <Pencil className="h-3 w-3 text-gold" aria-hidden="true" />
          ) : (
            <Lock className="h-3 w-3 text-ink-subtle" aria-hidden="true" />
          )}
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t(labelKey, { defaultValue: labelDefault })}
          </span>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            aria-label={t("contracts.compose.steps.step3.editSection", {
              defaultValue: "Edit",
            })}
          >
            <Pencil className="h-3 w-3" />
            {t("contracts.compose.steps.step3.editSection", { defaultValue: "Edit" })}
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={save}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-ink hover:bg-gold/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {t("common.save", { defaultValue: "Save" })}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              <XIcon className="h-3 w-3" />
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
          </div>
        )}
      </div>
      {isEditing ? (
        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          dir={dir}
          rows={Math.min(20, Math.max(6, draftBody.split("\n").length + 1))}
          className={cn(
            "mt-2 w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm leading-relaxed text-ink shadow-sm",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "font-mono",
          )}
          placeholder={t("contracts.compose.steps.step3.editPlaceholder", {
            defaultValue:
              "Edit the wording. {{token}} placeholders will be substituted in the preview.",
          })}
          disabled={disabled}
        />
      ) : (
        <PlaceholderRenderedBody body={body} placeholderValues={placeholderValues} dir={dir} />
      )}
    </div>
  );
}

// ─── SortableClauseSection ───────────────────────────────────────────────────

function SortableClauseSection({
  section,
  index,
  language,
  placeholderValues,
  onRemove,
  onChange,
  disabled,
}: {
  section: ComposeBodySection;
  index: number;
  language: "en" | "ar";
  placeholderValues: Record<string, string>;
  onRemove: () => void;
  onChange: (patch: Partial<ComposeBodySection>) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const title = section.title ?? "";
  const body = (language === "ar" ? section.bodyAr : section.bodyEn) ?? "";
  const dir = language === "ar" ? "rtl" : "ltr";

  // 2026-06-11 — inline edit mode for clause title + body. Drafter needs to
  // negotiate wording; drag-reorder + remove alone weren't enough.
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftBody, setDraftBody] = useState(body);
  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(title);
      setDraftBody(body);
    }
  }, [title, body, isEditing]);

  const save = () => {
    const patch: Partial<ComposeBodySection> = { title: draftTitle };
    if (language === "ar") patch.bodyAr = draftBody;
    else patch.bodyEn = draftBody;
    onChange(patch);
    setIsEditing(false);
  };
  const cancel = () => {
    setDraftTitle(title);
    setDraftBody(body);
    setIsEditing(false);
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-card p-3 transition-colors",
        isDragging ? "border-gold ring-1 ring-gold/30" : "border-border",
        isEditing && "ring-1 ring-gold/40",
      )}
      dir={dir}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("contracts.compose.steps.step3.dragHandle", {
            defaultValue: "Drag clause {{n}} to reorder",
            n: index,
          })}
          className="mt-0.5 cursor-grab rounded-md p-1 text-ink-subtle hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing disabled:opacity-40"
          disabled={isEditing}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {index}.
            </span>
            {isEditing ? (
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                disabled={disabled}
                dir={dir}
                className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1 text-sm font-semibold text-ink shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={t("contracts.compose.steps.step3.editTitlePlaceholder", {
                  defaultValue: "Clause title",
                })}
              />
            ) : (
              <h4 className="text-sm font-semibold text-ink">{title}</h4>
            )}
            {section.source === "library" && (
              <span className="rounded-full bg-gold/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink">
                {t("contracts.compose.steps.step3.fromLibrary", {
                  defaultValue: "from library",
                })}
              </span>
            )}
            {section.source === "template" && (
              <span className="rounded-full bg-sage/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sage">
                {t("contracts.compose.steps.step3.fromTemplate", {
                  defaultValue: "from template",
                })}
              </span>
            )}
          </div>
          {isEditing ? (
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              dir={dir}
              rows={Math.min(20, Math.max(6, draftBody.split("\n").length + 1))}
              className={cn(
                "mt-2 w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm leading-relaxed text-ink shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "font-mono",
              )}
              placeholder={t("contracts.compose.steps.step3.editPlaceholder", {
                defaultValue:
                  "Edit the wording. {{token}} placeholders will be substituted in the preview.",
              })}
              disabled={disabled}
            />
          ) : (
            <PlaceholderRenderedBody body={body} placeholderValues={placeholderValues} dir={dir} />
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                disabled={disabled}
                className="rounded-md p-1 text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                aria-label={t("contracts.compose.steps.step3.editClauseAria", {
                  defaultValue: "Edit clause {{n}}",
                  n: index,
                })}
                title={t("contracts.compose.steps.step3.editSection", {
                  defaultValue: "Edit",
                })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="rounded-md p-1 text-ink-subtle hover:bg-terracotta/10 hover:text-terracotta focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={t("contracts.compose.steps.step3.removeClauseAria", {
                  defaultValue: "Remove clause {{n}}",
                  n: index,
                })}
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={save}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-1.5 py-1 text-[10px] font-medium text-ink hover:bg-gold/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                {t("common.save", { defaultValue: "Save" })}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                <XIcon className="h-3 w-3" />
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── PlaceholderRenderedBody ─────────────────────────────────────────────────

/**
 * Convert inline Markdown bold/italic markers in a plain text segment into
 * React nodes. Handles `**bold**` and `__bold__` → <strong>, `*it*` and `_it_`
 * → <em>. Orphan markers left after a placeholder-split (e.g. a leading or
 * trailing `**` with no matching pair in this segment) are stripped so they
 * don't render as literal asterisks. Keeps the rest of the text intact.
 */
function renderInlineMarkdown(input: string): React.ReactNode[] {
  if (!input) return [];
  // 1. Strip orphan double-marker at very start/end (the common case where
  //    `**{{name}}**` got split into "**" + placeholder + "** ...").
  let s = input;
  if (/^\*\*(?!\*)/.test(s) && (s.match(/\*\*/g) || []).length % 2 === 1) {
    s = s.replace(/^\*\*/, "");
  }
  if (/\*\*(?!\*)$/.test(s) && (s.match(/\*\*/g) || []).length % 2 === 1) {
    s = s.replace(/\*\*$/, "");
  }
  // 2. Walk balanced **bold** / __bold__ pairs into <strong>; emit the rest
  //    as plain text spans.
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(<span key={`t${idx++}`}>{s.slice(last, m.index)}</span>);
    parts.push(<strong key={`b${idx++}`}>{m[1] ?? m[2] ?? ""}</strong>);
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(<span key={`t${idx++}`}>{s.slice(last)}</span>);
  return parts;
}

/**
 * Render a clause / preamble / signature body with {{token}} placeholders
 * substituted by the matching value from placeholderValues. Filled tokens
 * are wrapped in a gold <mark>; unfilled tokens stay visible as raw text in
 * a destructive-tinted mark so the drafter sees the gap.
 */
function PlaceholderRenderedBody({
  body,
  placeholderValues,
  dir,
}: {
  body: string;
  placeholderValues: Record<string, string>;
  dir: "ltr" | "rtl";
}) {
  const segments = useMemo(() => {
    // Strip Markdown bold markers that surround a placeholder token. Templates
    // commonly wrap party names with `**{{discloser_name}}**` for typographic
    // emphasis; once the placeholder is substituted, the gold <mark> below
    // already provides the visual hit, and the literal `**` would otherwise
    // leak into the preview.
    const cleaned = body.replace(
      /\*\*\s*(\{\{[a-zA-Z0-9_]+\}\})\s*\*\*/g,
      "$1",
    );
    const re = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const out: Array<{ kind: "text" | "placeholder"; content: string; key?: string }> = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) {
      if (m.index > lastIdx) {
        out.push({ kind: "text", content: cleaned.slice(lastIdx, m.index) });
      }
      out.push({ kind: "placeholder", content: m[0], key: m[1] });
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < cleaned.length) {
      out.push({ kind: "text", content: cleaned.slice(lastIdx) });
    }
    return out;
  }, [body]);

  return (
    <div
      dir={dir}
      className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink"
    >
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          // Render inline Markdown bold (**text**) as <strong> and strip
          // orphan `**` markers left behind when a bold span was split by
          // a {{placeholder}} substitution. Avoids `**ADNOC...**` leaking
          // into the preview verbatim.
          return <span key={i}>{renderInlineMarkdown(seg.content)}</span>;
        }
        const v = (seg.key && placeholderValues[seg.key]) || "";
        if (v.trim()) {
          return (
            <mark
              key={i}
              className="rounded bg-gold/25 px-1 py-0.5 text-ink"
              title={`{{${seg.key}}}`}
            >
              {v}
            </mark>
          );
        }
        return (
          <mark
            key={i}
            className="rounded bg-terracotta/15 px-1 py-0.5 font-mono text-[12px] text-terracotta"
            title="Fill this placeholder in Step 2"
          >
            {seg.content}
          </mark>
        );
      })}
    </div>
  );
}

export default Step3Terms;
