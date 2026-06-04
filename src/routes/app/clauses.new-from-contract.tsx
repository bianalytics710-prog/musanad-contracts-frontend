/**
 * /app/clauses/new-from-contract — upload a contract, let the AI split it into
 * candidate clauses, and let the user multi-select which ones to add to the
 * library.
 *
 * Flow:
 *   1. Upload PDF/DOCX (drag-drop or file picker — same pattern as
 *      templates.new-from-contract.tsx).
 *   2. FE extracts text via @/features/imports/lib/extract-text.
 *   3. POST /api/v1/clauses/extract-from-contract → ClauseCandidate[].
 *   4. User reviews the list, edits any field inline, ticks the boxes for the
 *      clauses they want to save.
 *   5. "Create N clauses" iterates POST /api/v1/clauses per selected row.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Upload,
  Sparkles,
  AlertTriangle,
  FileText,
  X,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  clausesService,
  type ClauseCandidate,
} from "@/services/api/m_parity.service";
import { extractTextFromFile } from "@/features/imports/lib/extract-text";
import { translateApiError } from "@/lib/translate-api-error";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/clauses/new-from-contract")({
  component: () => (
    <ErrorBoundary>
      <NewFromContractView />
    </ErrorBoundary>
  ),
});

interface EditableCandidate extends ClauseCandidate {
  selected: boolean;
  expanded: boolean;
}

const CLAUSE_CATEGORIES = [
  "assignment",
  "confidentiality",
  "data_protection",
  "definitions",
  "dispute_resolution",
  "force_majeure",
  "governing_law",
  "indemnity",
  "insurance",
  "intellectual_property",
  "liability",
  "non_compete",
  "notice",
  "payment",
  "representations",
  "severability",
  "term",
  "termination",
  "warranties",
  "other",
] as const;

const VARIANT_TONE: Record<ClauseCandidate["variant"], string> = {
  standard: "bg-sage/15 text-sage",
  alternative: "bg-amber/15 text-amber-ink",
  fallback: "bg-terracotta/15 text-terracotta",
};

function NewFromContractView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [candidates, setCandidates] = useState<EditableCandidate[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [extractStep, setExtractStep] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const extractMutation = useMutation({
    mutationFn: async (input: { filename: string; extractedText: string }) =>
      clausesService.extractFromContract(input),
    onError: (e) =>
      toast.error(translateApiError(e, t, "errors.clause.extractFailed")),
  });

  // Mirror the templates progress UI — the LLM call is opaque, so we drive
  // the visible steps off timers while it's pending.
  useEffect(() => {
    if (!extractMutation.isPending) {
      setExtractStep(0);
      return;
    }
    setExtractStep(1);
    const t1 = setTimeout(() => setExtractStep(2), 1500);
    const t2 = setTimeout(() => setExtractStep(3), 8000);
    const t3 = setTimeout(() => setExtractStep(4), 22000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [extractMutation.isPending]);

  const onSelect = (incoming: FileList | File[]) => {
    const f = Array.from(incoming)[0];
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      toast.error(
        t("clauses.newFromContract.invalidType", {
          defaultValue: "Only PDF or DOCX files are supported.",
        }),
      );
      return;
    }
    setFile(f);
  };

  const runExtraction = async () => {
    if (!file) return;
    try {
      const { text } = await extractTextFromFile(file);
      const result = await extractMutation.mutateAsync({
        filename: file.name,
        extractedText: text,
      });
      setCandidates(
        result.candidates.map((c) => ({
          ...c,
          selected: true,
          expanded: false,
        })),
      );
      setWarnings(result.warnings);
      if (result.candidates.length === 0) {
        toast.error(
          t("clauses.newFromContract.noCandidates", {
            defaultValue: "AI did not detect any clauses in this document.",
          }),
        );
      }
    } catch (err) {
      toast.error(
        t("clauses.newFromContract.extractFailed", {
          defaultValue: "Could not extract text from this file.",
        }) +
          " " +
          (err instanceof Error ? err.message : ""),
      );
    }
  };

  const updateCandidate = (idx: number, patch: Partial<EditableCandidate>) => {
    setCandidates((prev) =>
      prev ? prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)) : prev,
    );
  };

  const removeCandidate = (idx: number) => {
    setCandidates((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
  };

  const selectAll = (next: boolean) => {
    setCandidates((prev) =>
      prev ? prev.map((c) => ({ ...c, selected: next })) : prev,
    );
  };

  const selectedCount = candidates?.filter((c) => c.selected).length ?? 0;

  // Per-row create. We loop rather than batch so the DB enforces uniqueness +
  // permissions per call, matching how the inline create works.
  const createMutation = useMutation({
    mutationFn: async (rows: EditableCandidate[]) => {
      let ok = 0;
      const failures: Array<{ titleEn: string; message: string }> = [];
      for (const r of rows) {
        try {
          await clausesService.create({
            category: r.category,
            titleEn: r.titleEn,
            bodyEn: r.bodyEn,
            variant: r.variant,
            titleAr: r.titleAr,
            bodyAr: r.bodyAr,
            legalCommentaryEn: r.legalCommentaryEn,
            regulatoryRefs: r.regulatoryRefs.length > 0 ? r.regulatoryRefs : undefined,
          });
          ok++;
        } catch (e) {
          failures.push({
            titleEn: r.titleEn,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return { ok, failures };
    },
    onSuccess: ({ ok, failures }) => {
      void qc.invalidateQueries({ queryKey: ["clauses"] });
      if (failures.length === 0) {
        toast.success(
          t("clauses.newFromContract.createdAll", {
            defaultValue: "{{count}} clause(s) added to the library.",
            count: ok,
          }),
        );
        void navigate({ to: "/app/clauses" });
      } else {
        toast.warning(
          t("clauses.newFromContract.createdSome", {
            defaultValue:
              "{{ok}} clause(s) added, {{failed}} failed. See details below.",
            ok,
            failed: failures.length,
          }),
        );
      }
    },
  });

  const handleCreateSelected = () => {
    if (!candidates) return;
    const rows = candidates.filter((c) => c.selected);
    if (rows.length === 0) {
      toast.error(
        t("clauses.newFromContract.noneSelected", {
          defaultValue: "Select at least one clause to save.",
        }),
      );
      return;
    }
    const blanks = rows.filter(
      (r) => r.titleEn.trim().length === 0 || r.bodyEn.trim().length === 0,
    );
    if (blanks.length > 0) {
      toast.error(
        t("clauses.newFromContract.blankRows", {
          defaultValue:
            "{{count}} selected clause(s) are missing a title or body — fill them in or untick them.",
          count: blanks.length,
        }),
      );
      return;
    }
    createMutation.mutate(rows);
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 p-6">
      <Link
        to="/app/clauses"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("clauses.backToList", { defaultValue: "Back to clauses" })}
      </Link>

      <header>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          {t("clauses.kicker", { defaultValue: "Clause library" })}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("clauses.newFromContract.title", {
            defaultValue: "New clauses — from a contract",
          })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("clauses.newFromContract.subtitle", {
            defaultValue:
              "Upload a PDF/DOCX. The AI splits it into individual clauses; pick the ones worth adding to the library.",
          })}
        </p>
      </header>

      {!candidates ? (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("clauses.newFromContract.step1", {
                defaultValue: "Step 1 — Upload contract",
              })}
            </div>
            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  onSelect(e.dataTransfer.files);
                }}
                className={cn(
                  "flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
                  dragOver
                    ? "border-gold bg-gold/5"
                    : "border-border bg-surface/40 hover:border-gold/40 hover:bg-surface/60",
                )}
              >
                <Upload className="h-10 w-10 text-ink-subtle" strokeWidth={1.25} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink">
                    {t("clauses.newFromContract.dropTitle", {
                      defaultValue: "Drop a contract file here",
                    })}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {t("clauses.newFromContract.dropSubtitle", {
                      defaultValue: "PDF or DOCX, single file",
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                >
                  {t("clauses.newFromContract.chooseFile", {
                    defaultValue: "Choose file",
                  })}
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) onSelect(e.target.files);
                    e.target.value = "";
                  }}
                  aria-label={t("clauses.newFromContract.chooseFile", {
                    defaultValue: "Choose file",
                  })}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-md border border-border bg-surface/40 p-3">
                  <FileText className="h-4 w-4 shrink-0 text-ink-subtle" />
                  <span className="flex-1 truncate font-mono text-xs text-ink">
                    {file.name}
                  </span>
                  <span className="font-mono text-xs text-ink-muted">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFile(null)}
                    disabled={extractMutation.isPending}
                    aria-label={t("clauses.newFromContract.removeFile", {
                      defaultValue: "Remove file",
                    })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {extractMutation.isPending && (
                  <ExtractionProgress step={extractStep} />
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void runExtraction()}
                    disabled={extractMutation.isPending}
                  >
                    <Sparkles className="h-4 w-4" />
                    {extractMutation.isPending
                      ? t("clauses.newFromContract.extracting", {
                          defaultValue: "Extracting…",
                        })
                      : t("clauses.newFromContract.extract", {
                          defaultValue: "Extract clauses with AI",
                        })}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {warnings.length > 0 && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-amber-ink">
                  <AlertTriangle className="me-1 inline-block h-3 w-3" />
                  {t("clauses.newFromContract.reviewWarnings", {
                    defaultValue: "Review the warnings",
                  })}
                </div>
                <ul className="space-y-1 text-xs text-amber-ink">
                  {warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="rounded-md border border-sage/30 bg-sage-tint/40 px-3 py-2 text-xs text-sage-ink">
            {t("clauses.newFromContract.step2", {
              defaultValue:
                "Step 2 — Tick the clauses you want to add. Edit category / variant / wording inline. Untick anything boilerplate.",
            })}
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-ink">
                  {t("clauses.newFromContract.summary", {
                    defaultValue: "{{selected}} of {{total}} selected",
                    selected: selectedCount,
                    total: candidates.length,
                  })}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => selectAll(true)}
                >
                  {t("common.selectAll", { defaultValue: "Select all" })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => selectAll(false)}
                >
                  {t("common.clear", { defaultValue: "Clear" })}
                </Button>
                <div className="ms-auto flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCandidates(null);
                      setFile(null);
                      setWarnings([]);
                    }}
                    disabled={createMutation.isPending}
                  >
                    {t("clauses.newFromContract.startOver", {
                      defaultValue: "Start over",
                    })}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateSelected}
                    disabled={createMutation.isPending || selectedCount === 0}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {t("clauses.newFromContract.createN", {
                      defaultValue: "Add {{count}} clause(s)",
                      count: selectedCount,
                    })}
                  </Button>
                </div>
              </div>

              <ul className="divide-y divide-border rounded-md border border-border">
                {candidates.map((c, idx) => (
                  <CandidateRow
                    key={idx}
                    cand={c}
                    onPatch={(p) => updateCandidate(idx, p)}
                    onRemove={() => removeCandidate(idx)}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

interface CandidateRowProps {
  cand: EditableCandidate;
  onPatch: (patch: Partial<EditableCandidate>) => void;
  onRemove: () => void;
}

function CandidateRow({ cand, onPatch, onRemove }: CandidateRowProps) {
  const { t } = useTranslation();

  return (
    <li className="p-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={cand.selected}
          onChange={(e) => onPatch({ selected: e.target.checked })}
          className="mt-1 h-4 w-4 cursor-pointer accent-gold"
          aria-label={t("clauses.newFromContract.selectRow", {
            defaultValue: "Select this clause",
          })}
        />
        <button
          type="button"
          onClick={() => onPatch({ expanded: !cand.expanded })}
          className="mt-0.5 shrink-0 text-ink-subtle hover:text-ink"
          aria-label={
            cand.expanded
              ? t("clauses.newFromContract.collapseEditor", {
                  defaultValue: "Close editor",
                })
              : t("clauses.newFromContract.openEditor", {
                  defaultValue: "Edit fields",
                })
          }
        >
          {cand.expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                VARIANT_TONE[cand.variant],
              )}
            >
              {cand.variant}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {cand.category.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm font-medium text-ink">{cand.titleEn}</p>
          {!cand.expanded && (
            <pre className="whitespace-pre-wrap break-words rounded-md bg-surface/60 p-3 font-sans text-xs leading-5 text-ink-muted">
              {cand.bodyEn}
            </pre>
          )}
          {!cand.expanded && cand.bodyAr && (
            <pre
              className="whitespace-pre-wrap break-words rounded-md bg-surface/60 p-3 font-sans text-xs leading-5 text-ink-muted"
              dir="rtl"
            >
              {cand.bodyAr}
            </pre>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={t("clauses.newFromContract.removeRow", {
            defaultValue: "Discard this clause",
          })}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {cand.expanded && (
        <div className="mt-3 space-y-3 ps-7">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink">
                {t("clauses.fields.category", { defaultValue: "Category" })}
              </span>
              <select
                value={cand.category}
                onChange={(e) => onPatch({ category: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CLAUSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink">
                {t("clauses.fields.variant", { defaultValue: "Variant" })}
              </span>
              <select
                value={cand.variant}
                onChange={(e) =>
                  onPatch({
                    variant: e.target.value as ClauseCandidate["variant"],
                  })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="alternative">Alternative</option>
                <option value="fallback">Fallback</option>
              </select>
            </label>
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-xs font-medium text-ink">
                {t("clauses.fields.titleEn", { defaultValue: "Title (English)" })}
              </span>
              <Input
                value={cand.titleEn}
                onChange={(e) => onPatch({ titleEn: e.target.value })}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">
              {t("clauses.fields.bodyEn", { defaultValue: "Body (English)" })}
            </span>
            <textarea
              rows={Math.min(20, Math.max(6, Math.ceil(cand.bodyEn.length / 80)))}
              value={cand.bodyEn}
              onChange={(e) => onPatch({ bodyEn: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-5 text-ink"
            />
          </label>

          {(cand.titleAr || cand.bodyAr) && (
            <div className="grid gap-3 sm:grid-cols-2" dir="rtl">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink">
                  {t("clauses.fields.titleAr", { defaultValue: "Title (Arabic)" })}
                </span>
                <Input
                  value={cand.titleAr ?? ""}
                  onChange={(e) => onPatch({ titleAr: e.target.value || null })}
                />
              </label>
              {cand.bodyAr && (
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-ink">
                    {t("clauses.fields.bodyAr", {
                      defaultValue: "Body (Arabic)",
                    })}
                  </span>
                  <textarea
                    rows={Math.min(20, Math.max(4, Math.ceil((cand.bodyAr ?? "").length / 80)))}
                    value={cand.bodyAr ?? ""}
                    onChange={(e) =>
                      onPatch({ bodyAr: e.target.value || null })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-5 text-ink"
                  />
                </label>
              )}
            </div>
          )}

          {cand.legalCommentaryEn && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink">
                {t("clauses.fields.legalCommentaryEn", {
                  defaultValue: "Legal commentary",
                })}
              </span>
              <textarea
                rows={3}
                value={cand.legalCommentaryEn}
                onChange={(e) =>
                  onPatch({ legalCommentaryEn: e.target.value || null })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-ink"
              />
            </label>
          )}

          {cand.regulatoryRefs.length > 0 && (
            <div>
              <span className="mb-1 block text-xs font-medium text-ink">
                {t("clauses.fields.regulatoryRefs", {
                  defaultValue: "Regulatory references",
                })}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cand.regulatoryRefs.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-ink-muted"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

interface ProgressStep {
  key: string;
  labelKey: string;
  defaultLabel: string;
}

const PROGRESS_STEPS: ProgressStep[] = [
  {
    key: "reading",
    labelKey: "clauses.newFromContract.progress.reading",
    defaultLabel: "Reading file",
  },
  {
    key: "uploading",
    labelKey: "clauses.newFromContract.progress.uploading",
    defaultLabel: "Sending document to AI",
  },
  {
    key: "analyzing",
    labelKey: "clauses.newFromContract.progress.analyzing",
    defaultLabel: "AI splitting into clauses",
  },
  {
    key: "building",
    labelKey: "clauses.newFromContract.progress.building",
    defaultLabel: "Building candidate list",
  },
];

function ExtractionProgress({ step }: { step: number }) {
  const { t } = useTranslation();
  const activeIdx = Math.max(0, Math.min(PROGRESS_STEPS.length, step) - 1);
  const pct = ((activeIdx + 1) / PROGRESS_STEPS.length) * 100;

  return (
    <div className="rounded-md border border-gold/30 bg-gold/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          {t("clauses.newFromContract.progressTitle", {
            defaultValue: "Extracting clauses",
          })}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
          {t("clauses.newFromContract.progressHint", {
            defaultValue: "30–60 seconds",
          })}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-gold transition-all duration-700 ease-out"
          style={{ width: pct + "%" }}
        />
      </div>
      <ul className="space-y-1.5">
        {PROGRESS_STEPS.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              {done ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-sage" />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gold" />
              ) : (
                <span className="block h-3.5 w-3.5 shrink-0 rounded-full border border-border" />
              )}
              <span
                className={
                  done
                    ? "text-ink-muted"
                    : active
                      ? "font-medium text-ink"
                      : "text-ink-subtle"
                }
              >
                {t(s.labelKey, { defaultValue: s.defaultLabel })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
