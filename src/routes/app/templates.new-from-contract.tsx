/**
 * /app/templates/new-from-contract — upload a PDF/DOCX and get:
 *
 *   1. A redacted template (body + placeholders) — same as before.
 *   2. A "Match results" decision step (NEW):
 *      - exact match  → link to existing template (single button).
 *      - extend       → choose "Save as new" OR open existing.
 *      - no match     → quietly proceed to editor.
 *   3. A clause-library cross-check card (NEW):
 *      The N clauses we extracted from the source — flagged as "in library"
 *      or "new". Drafter can multi-select the new ones and add them to the
 *      library before / after saving the template.
 */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
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
  ExternalLink,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  useAnalyzeTemplateUpload,
  useCreateTemplate,
} from "@/features/templates/hooks/useTemplates";
import { TemplateEditorForm } from "@/features/templates/components/TemplateEditorForm";
import { extractTextFromFile } from "@/features/imports/lib/extract-text";
import {
  clausesService,
  type AnalyzeTemplateUploadResult,
  type ClauseCrossCheckRow,
  type TemplateMatchRow,
} from "@/services/api/m_parity.service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/templates/new-from-contract")({
  component: () => (
    <ErrorBoundary>
      <NewFromContractView />
    </ErrorBoundary>
  ),
});

type Step = "upload" | "match-decision" | "editor";

function NewFromContractView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const analyzeMutation = useAnalyzeTemplateUpload();
  const createMutation = useCreateTemplate();

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [analysis, setAnalysis] =
    useState<AnalyzeTemplateUploadResult | null>(null);
  const [extractStep, setExtractStep] = useState<number>(0);
  const [step, setStep] = useState<Step>("upload");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!analyzeMutation.isPending) {
      setExtractStep(0);
      return;
    }
    setExtractStep(1);
    const t1 = setTimeout(() => setExtractStep(2), 1500);
    const t2 = setTimeout(() => setExtractStep(3), 8000);
    const t3 = setTimeout(() => setExtractStep(4), 22000);
    const t4 = setTimeout(() => setExtractStep(5), 40000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [analyzeMutation.isPending]);

  const onSelect = (incoming: FileList | File[]) => {
    const f = Array.from(incoming)[0];
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      toast.error(
        t("templates.newFromContract.invalidType", {
          defaultValue: "Only PDF or DOCX files are supported.",
        }),
      );
      return;
    }
    setFile(f);
  };

  const runAnalysis = async () => {
    if (!file) return;
    try {
      const { text } = await extractTextFromFile(file);
      const result = await analyzeMutation.mutateAsync({
        filename: file.name,
        extractedText: text,
      });
      setAnalysis(result);
      setStep("match-decision");
    } catch (err) {
      toast.error(
        t("templates.newFromContract.extractFailed", {
          defaultValue: "Could not extract text from this file.",
        }) +
          " " +
          (err instanceof Error ? err.message : ""),
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 p-6">
      <Link
        to="/app/templates"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-gold"
      >
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        {t("templates.backToList", { defaultValue: "Back to templates" })}
      </Link>

      <header>
        <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-subtle">
          {t("templates.kicker", { defaultValue: "Template library" })}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("templates.newFromContract.title", {
            defaultValue: "New template — from a contract",
          })}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("templates.newFromContract.subtitle", {
            defaultValue:
              "Upload a finalised PDF/DOCX. The AI identifies entity-specific data, redacts it into placeholders, and checks the result against your existing template + clause library so you can extend rather than duplicate.",
          })}
        </p>
      </header>

      {step === "upload" && (
        <UploadCard
          file={file}
          onPick={() => inputRef.current?.click()}
          inputRef={inputRef}
          onFileChange={onSelect}
          dragOver={dragOver}
          setDragOver={setDragOver}
          onClear={() => setFile(null)}
          onRun={() => void runAnalysis()}
          isPending={analyzeMutation.isPending}
          extractStep={extractStep}
        />
      )}

      {step === "match-decision" && analysis && (
        <MatchDecision
          analysis={analysis}
          onProceedAsNew={() => setStep("editor")}
          isSaving={createMutation.isPending}
        />
      )}

      {step === "editor" && analysis && (
        <EditorStep
          analysis={analysis}
          onCancel={() => {
            setAnalysis(null);
            setFile(null);
            setStep("upload");
          }}
          onSubmit={async (input) => {
            const created = await createMutation.mutateAsync(input);
            // After a template save we also let the user add the "new" clauses
            // (if they selected any earlier). For now we navigate to the new
            // template; the clause additions are tracked separately on the
            // MatchDecision card and persisted immediately on confirm there.
            await qc.invalidateQueries({ queryKey: ["templates"] });
            void navigate({
              to: "/app/templates/$id",
              params: { id: String(created.id) },
            });
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 1 — Upload card. Mostly unchanged from the previous flow.
// ─────────────────────────────────────────────────────────────

interface UploadCardProps {
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: () => void;
  onFileChange: (f: FileList | File[]) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onClear: () => void;
  onRun: () => void;
  isPending: boolean;
  extractStep: number;
}

function UploadCard(props: UploadCardProps) {
  const { t } = useTranslation();
  const {
    file,
    inputRef,
    onPick,
    onFileChange,
    dragOver,
    setDragOver,
    onClear,
    onRun,
    isPending,
    extractStep,
  } = props;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          {t("templates.newFromContract.step1", { defaultValue: "Step 1 — Upload contract" })}
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
              onFileChange(e.dataTransfer.files);
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
                {t("templates.newFromContract.dropTitle", {
                  defaultValue: "Drop a contract file here",
                })}
              </p>
              <p className="text-xs text-ink-muted">
                {t("templates.newFromContract.dropSubtitle", {
                  defaultValue: "PDF or DOCX, single file",
                })}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onPick}>
              {t("templates.newFromContract.chooseFile", { defaultValue: "Choose file" })}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) onFileChange(e.target.files);
                e.target.value = "";
              }}
              aria-label={t("templates.newFromContract.chooseFile", {
                defaultValue: "Choose file",
              })}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface/40 p-3">
              <FileText className="h-4 w-4 shrink-0 text-ink-subtle" />
              <span className="flex-1 truncate font-mono text-xs text-ink">{file.name}</span>
              <span className="font-mono text-xs text-ink-muted">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClear}
                disabled={isPending}
                aria-label={t("templates.newFromContract.removeFile", {
                  defaultValue: "Remove file",
                })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {isPending && <ExtractionProgress step={extractStep} />}
            <div className="flex justify-end">
              <Button type="button" onClick={onRun} disabled={isPending}>
                <Sparkles className="h-4 w-4" />
                {isPending
                  ? t("templates.newFromContract.analyzing", { defaultValue: "Analyzing…" })
                  : t("templates.newFromContract.analyze", {
                      defaultValue: "Analyze with AI",
                    })}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2 — Match decision + clause cross-check.
// ─────────────────────────────────────────────────────────────

interface MatchDecisionProps {
  analysis: AnalyzeTemplateUploadResult;
  onProceedAsNew: () => void;
  isSaving: boolean;
}

function MatchDecision({ analysis, onProceedAsNew, isSaving }: MatchDecisionProps) {
  const { t } = useTranslation();
  const top = analysis.templateMatches[0];
  const classification = analysis.topMatchClassification;
  const formatPct = (s: number) => Math.round(s * 100) + "%";

  return (
    <div className="space-y-4">
      {analysis.warnings.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-amber-ink">
              <AlertTriangle className="me-1 inline-block h-3 w-3" />
              {t("templates.newFromContract.reviewWarnings", {
                defaultValue: "Review the warnings",
              })}
            </div>
            <ul className="space-y-1 text-xs text-amber-ink">
              {analysis.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border border-sage/30 bg-sage-tint/40 px-3 py-2 text-xs text-sage-ink">
        {t("templates.newFromContract.step2", {
          defaultValue:
            "Step 2 — We checked the uploaded contract against your template and clause libraries.",
        })}
      </div>

      {/* Template-match panel */}
      {classification === "exact" && top ? (
        <ExactMatchPanel
          match={top}
          pct={formatPct(top.similarity)}
          pctNum={Math.round(top.similarity * 100)}
          onProceedAsNew={onProceedAsNew}
        />
      ) : classification === "extend_candidate" && top ? (
        <ExtendCandidatePanel
          match={top}
          pct={formatPct(top.similarity)}
          pctNum={Math.round(top.similarity * 100)}
          onProceedAsNew={onProceedAsNew}
        />
      ) : (
        <NoMatchPanel onProceedAsNew={onProceedAsNew} />
      )}

      {/* Clause cross-check */}
      <ClauseCrossCheckCard rows={analysis.clauseCrossCheck} thresholds={analysis.thresholds} />

      {/* Save-as-new button — only when not on exact match path */}
      {classification !== "exact" && (
        <div className="flex items-center justify-end">
          <Button onClick={onProceedAsNew} disabled={isSaving}>
            <Sparkles className="h-4 w-4" />
            {t("templates.newFromContract.continueAsNew", {
              defaultValue: "Continue — review redacted body",
            })}
          </Button>
        </div>
      )}
    </div>
  );
}

function ExactMatchPanel({
  match,
  pct,
  pctNum,
  onProceedAsNew,
}: {
  match: TemplateMatchRow;
  pct: string;
  pctNum: number;
  onProceedAsNew: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-amber/15 p-2">
            <CheckCircle2 className="h-5 w-5 text-amber-ink" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-amber-ink">
              {t("templates.match.exactKicker", { defaultValue: "This template already exists" })}
            </div>
            <p className="text-lg font-semibold text-ink">{match.nameEn}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-surface px-2 py-0.5 font-mono uppercase tracking-wider text-ink-muted">
                {match.contractType}
              </span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-ink-muted">
                {t("templates.match.usedTimes", { defaultValue: "Used {{n}} time(s)", n: match.usageCount })}
              </span>
            </div>
          </div>
          <MatchPercentPill pct={pct} pctNum={pctNum} tone="exact" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/templates/$id" params={{ id: String(match.templateId) }}>
            <Button size="sm">
              <ExternalLink className="h-4 w-4" />
              {t("templates.match.openExisting", { defaultValue: "Open existing template" })}
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={onProceedAsNew}>
            {t("templates.match.saveAsNewAnyway", {
              defaultValue: "No — save as a new template anyway",
            })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Big readable percent — extend uses gold, exact uses amber. Stacked digit + caption
 * + tonal background so the score is the most prominent thing on the card.
 */
function MatchPercentPill({
  pct,
  pctNum: _pctNum,
  tone,
}: {
  pct: string;
  pctNum: number;
  tone: "exact" | "extend";
}) {
  const { t } = useTranslation();
  const palette =
    tone === "exact"
      ? "border-amber/40 bg-amber/15 text-amber-ink"
      : "border-gold/40 bg-gold/15 text-gold";
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-lg border px-4 py-2 text-center",
        palette,
      )}
      role="status"
      aria-label={t("templates.match.matchPctAria", { defaultValue: "{{pct}} match", pct })}
    >
      <div className="text-2xl font-bold leading-none tabular-nums">{pct}</div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider opacity-80">
        {t("templates.match.matchLabel", { defaultValue: "Match" })}
      </div>
    </div>
  );
}

function ExtendCandidatePanel({
  match,
  pct,
  pctNum,
  onProceedAsNew,
}: {
  match: TemplateMatchRow;
  pct: string;
  pctNum: number;
  onProceedAsNew: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-gold/15 p-2">
            <CircleDot className="h-5 w-5 text-gold" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-gold">
              {t("templates.match.extendKicker", { defaultValue: "Closest existing template" })}
            </div>
            <p className="text-lg font-semibold text-ink">{match.nameEn}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-surface px-2 py-0.5 font-mono uppercase tracking-wider text-ink-muted">
                {match.contractType}
              </span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-ink-muted">
                {t("templates.match.usedTimes", { defaultValue: "Used {{n}} time(s)", n: match.usageCount })}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink">
              {t("templates.match.extendCopy", {
                defaultValue:
                  "Looks similar to a template you already have. You can store this as a new template, or open the existing one and add the new clauses there.",
              })}
            </p>
          </div>
          <MatchPercentPill pct={pct} pctNum={pctNum} tone="extend" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/templates/$id/edit" params={{ id: String(match.templateId) }}>
            <Button size="sm" variant="outline">
              <ExternalLink className="h-4 w-4" />
              {t("templates.match.openToExtend", {
                defaultValue: "Open {{name}} to extend",
                name: match.nameEn,
              })}
            </Button>
          </Link>
          <Button size="sm" onClick={onProceedAsNew}>
            {t("templates.match.saveAsNew", { defaultValue: "Save as a new template" })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NoMatchPanel({ onProceedAsNew }: { onProceedAsNew: () => void }) {
  const { t } = useTranslation();
  // Keep this quiet — small info pill, autoreveal the editor link.
  return (
    <div className="rounded-md border border-border bg-surface/60 px-3 py-2 text-xs text-ink-muted">
      <CheckCircle2 className="me-1 inline-block h-3 w-3 text-sage" />
      {t("templates.match.noMatchCopy", {
        defaultValue:
          "No close match found — this looks like a brand-new template. Continue to review the redacted body.",
      })}
      <Button variant="link" size="sm" className="px-1 text-xs" onClick={onProceedAsNew}>
        {t("templates.match.continueLink", { defaultValue: "Continue →" })}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Clause cross-check card — multi-select adds-to-library.
// ─────────────────────────────────────────────────────────────

interface ClauseCrossCheckCardProps {
  rows: ClauseCrossCheckRow[];
  thresholds: { exact: number; extend: number; clauseMatch: number };
}

function ClauseCrossCheckCard({ rows, thresholds }: ClauseCrossCheckCardProps) {
  const { t } = useTranslation();
  const { newRows, knownRows } = useMemo(() => {
    return {
      newRows: rows.filter((r) => r.isNewToLibrary),
      knownRows: rows.filter((r) => !r.isNewToLibrary),
    };
  }, [rows]);

  // Tick the new ones by default. Known clauses are read-only.
  const [selected, setSelected] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    rows.forEach((r, i) => {
      init[i] = r.isNewToLibrary;
    });
    return init;
  });

  const toggleAll = (next: boolean) => {
    setSelected((prev) => {
      const out: Record<number, boolean> = {};
      rows.forEach((r, i) => {
        out[i] = r.isNewToLibrary ? next : prev[i] ?? false;
      });
      return out;
    });
  };

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const qc = useQueryClient();
  const addMutation = useMutation({
    mutationFn: async () => {
      const ok: number[] = [];
      const failed: Array<{ titleEn: string; message: string }> = [];
      for (let i = 0; i < rows.length; i++) {
        if (!selected[i]) continue;
        const r = rows[i];
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
          ok.push(i);
        } catch (e) {
          failed.push({
            titleEn: r.titleEn,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      void qc.invalidateQueries({ queryKey: ["clauses"] });
      if (failed.length === 0) {
        toast.success(
          t("templates.crossCheck.addedAll", {
            defaultValue: "{{count}} clause(s) added to your library.",
            count: ok.length,
          }),
        );
      } else {
        toast.warning(
          t("templates.crossCheck.addedSome", {
            defaultValue: "{{ok}} added, {{failed}} failed.",
            ok: ok.length,
            failed: failed.length,
          }),
        );
      }
      // Mark the saved rows as "now in library" — keep them selected ticked.
      setSelected((prev) => {
        const out = { ...prev };
        ok.forEach((i) => {
          out[i] = false;
        });
        return out;
      });
    },
    onError: () => {
      toast.error(
        t("templates.crossCheck.addFailed", { defaultValue: "Failed to add clauses to library." }),
      );
    },
  });

  if (rows.length === 0) {
    return null;
  }

  const matchPctLabel = Math.round(thresholds.clauseMatch * 100);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            {t("templates.crossCheck.kicker", { defaultValue: "Clause library cross-check" })}
          </div>
          <p className="text-sm text-ink">
            {t("templates.crossCheck.summary", {
              defaultValue:
                "We found {{total}} clauses in the uploaded contract. {{n}} are not in your clause library.",
              total: rows.length,
              n: newRows.length,
            })}
            {newRows.length > 0 && (
              <>
                {" "}
                <span className="text-ink-muted">
                  {t("templates.crossCheck.threshold", {
                    defaultValue: "(below {{pct}}% similarity to any existing clause)",
                    pct: matchPctLabel,
                  })}
                </span>
              </>
            )}
          </p>
          {newRows.length > 0 && rows.length > 0 && (
            <p className="mt-1 text-[11px] leading-snug text-ink-muted">
              {t("templates.crossCheck.explainer", {
                defaultValue:
                  "Note: the template-match score above compares the whole document — a high score means similar shape and topic. Each clause is checked against the library individually here, so the actual wording can still be different even on a close template match.",
              })}
            </p>
          )}
        </div>

        {newRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-ink">
                {t("templates.crossCheck.newSelected", {
                  defaultValue: "{{selected}} of {{total}} selected to add",
                  selected: selectedCount,
                  total: newRows.length,
                })}
              </p>
              <Button size="sm" variant="ghost" onClick={() => toggleAll(true)}>
                {t("common.selectAll", { defaultValue: "Select all" })}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>
                {t("common.clear", { defaultValue: "Clear" })}
              </Button>
              <div className="ms-auto">
                <Button
                  size="sm"
                  onClick={() => addMutation.mutate()}
                  disabled={addMutation.isPending || selectedCount === 0}
                >
                  {addMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {t("templates.crossCheck.addToLibrary", {
                    defaultValue: "Add {{count}} clause(s) to library",
                    count: selectedCount,
                  })}
                </Button>
              </div>
            </div>
            <ul className="divide-y divide-border rounded-md border border-border">
              {rows.map((r, idx) =>
                r.isNewToLibrary ? (
                  <ClauseRow
                    key={idx}
                    row={r}
                    isNew
                    checked={selected[idx] ?? false}
                    onToggle={(v) =>
                      setSelected((prev) => ({ ...prev, [idx]: v }))
                    }
                  />
                ) : null,
              )}
            </ul>
          </div>
        )}

        {knownRows.length > 0 && (
          <details className="rounded-md border border-border bg-surface/30">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-muted">
              {t("templates.crossCheck.knownToggle", {
                defaultValue: "{{n}} clauses already in your library",
                n: knownRows.length,
              })}
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {rows.map((r, idx) =>
                !r.isNewToLibrary ? (
                  <ClauseRow key={idx} row={r} isNew={false} checked={false} onToggle={() => {}} />
                ) : null,
              )}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function ClauseRow({
  row,
  isNew,
  checked,
  onToggle,
}: {
  row: ClauseCrossCheckRow;
  isNew: boolean;
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const pct = Math.round(row.bestSimilarity * 100);
  return (
    <li className="p-3">
      <div className="flex items-start gap-3">
        {isNew ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggle(e.target.checked)}
            className="mt-1 h-4 w-4 cursor-pointer accent-gold"
            aria-label={t("templates.crossCheck.selectRow", {
              defaultValue: "Select this clause",
            })}
          />
        ) : (
          <Check className="mt-1 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
              {row.category.replace(/_/g, " ")}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                isNew
                  ? "bg-gold/15 text-gold"
                  : "bg-sage/15 text-sage",
              )}
            >
              {isNew
                ? t("templates.crossCheck.newTag", { defaultValue: "New" })
                : t("templates.crossCheck.inLibraryTag", { defaultValue: "In library" })}
            </span>
            {!isNew && row.bestMatchTitle && (
              <span className="text-[11px] text-ink-muted">
                {t("templates.crossCheck.matches", {
                  defaultValue: "matches “{{name}}” ({{pct}}%)",
                  name: row.bestMatchTitle,
                  pct,
                })}
              </span>
            )}
            {isNew && row.bestMatchTitle && row.bestSimilarity > 0 && (
              <span className="text-[11px] text-ink-muted">
                {t("templates.crossCheck.closestNew", {
                  defaultValue: "closest in library: “{{name}}” ({{pct}}%)",
                  name: row.bestMatchTitle,
                  pct,
                })}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-ink">{row.titleEn}</p>
          <p className="line-clamp-2 text-xs text-ink-muted">{row.bodyEn}</p>
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 3 — Editor (existing TemplateEditorForm).
// ─────────────────────────────────────────────────────────────

interface EditorStepProps {
  analysis: AnalyzeTemplateUploadResult;
  onCancel: () => void;
  onSubmit: (input: import("@/services/api/m_parity.service").CreateTemplateInput) => Promise<void>;
}

function EditorStep({ analysis, onCancel, onSubmit }: EditorStepProps) {
  const { t } = useTranslation();
  const createMutation = useCreateTemplate();
  const e = analysis.template;
  return (
    <>
      <div className="rounded-md border border-sage/30 bg-sage-tint/40 px-3 py-2 text-xs text-sage-ink">
        {t("templates.newFromContract.step3", {
          defaultValue:
            "Step 3 — Review the redacted body + placeholder catalog. Save when ready.",
        })}
      </div>
      <TemplateEditorForm
        initial={{
          nameEn: e.nameEn,
          descriptionEn: e.descriptionEn,
          contractType: e.contractType,
          language: e.language,
          regulatoryReference: e.regulatoryReference,
          bodyEn: e.bodyEnRedacted,
          placeholders: e.placeholders,
        }}
        submitLabel={t("templates.actions.save", { defaultValue: "Save template" })}
        isSubmitting={createMutation.isPending}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Progress UI (extended with a 5th step for clause matching).
// ─────────────────────────────────────────────────────────────

interface ProgressStep {
  key: string;
  labelKey: string;
  defaultLabel: string;
}

const PROGRESS_STEPS: ProgressStep[] = [
  { key: "reading", labelKey: "templates.newFromContract.progress.reading", defaultLabel: "Reading file" },
  { key: "uploading", labelKey: "templates.newFromContract.progress.uploading", defaultLabel: "Sending document to AI" },
  { key: "analyzing", labelKey: "templates.newFromContract.progress.analyzing", defaultLabel: "AI analyzing structure and entities" },
  { key: "building", labelKey: "templates.newFromContract.progress.building", defaultLabel: "Splitting into clauses" },
  { key: "matching", labelKey: "templates.newFromContract.progress.matching", defaultLabel: "Matching against your libraries" },
];

function ExtractionProgress({ step }: { step: number }) {
  const { t } = useTranslation();
  const activeIdx = Math.max(0, Math.min(PROGRESS_STEPS.length, step) - 1);
  const pct = ((activeIdx + 1) / PROGRESS_STEPS.length) * 100;

  return (
    <div className="rounded-md border border-gold/30 bg-gold/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          {t("templates.newFromContract.progressTitle", {
            defaultValue: "Analyzing template",
          })}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
          {t("templates.newFromContract.progressHint", { defaultValue: "30–60 seconds" })}
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
                  done ? "text-ink-muted" : active ? "font-medium text-ink" : "text-ink-subtle"
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
