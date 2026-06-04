import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  useExtractTemplateFromContract,
  useCreateTemplate,
} from "@/features/templates/hooks/useTemplates";
import { TemplateEditorForm } from "@/features/templates/components/TemplateEditorForm";
import { extractTextFromFile } from "@/features/imports/lib/extract-text";
import type {
  ExtractTemplateFromContractResult,
} from "@/services/api/m_parity.service";
import { toast } from "sonner";

export const Route = createFileRoute("/app/templates/new-from-contract")({
  component: () => (
    <ErrorBoundary>
      <NewFromContractView />
    </ErrorBoundary>
  ),
});

function NewFromContractView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const extractMutation = useExtractTemplateFromContract();
  const createMutation = useCreateTemplate();

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [extracted, setExtracted] = useState<ExtractTemplateFromContractResult | null>(
    null,
  );
  const [extractStep, setExtractStep] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Drive the visible progress through fake-but-helpful steps. The real LLM
  // call is opaque; this gives the user something to track while it runs.
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
    const okExt = /\.(pdf|docx)$/i.test(f.name);
    if (!okExt) {
      toast.error(
        t("templates.newFromContract.invalidType", {
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
      setExtracted(result);
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
              "Upload a finalised PDF/DOCX. The AI identifies entity-specific data (parties, addresses, IDs, dates, amounts) and replaces them with {{placeholders}} you can review before saving.",
          })}
        </p>
      </header>

      {!extracted ? (
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
                  onSelect(e.dataTransfer.files);
                }}
                className={
                  "flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition-colors " +
                  (dragOver
                    ? "border-gold bg-gold/5"
                    : "border-border bg-surface/40 hover:border-gold/40 hover:bg-surface/60")
                }
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                >
                  {t("templates.newFromContract.chooseFile", {
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
                  aria-label={t("templates.newFromContract.chooseFile", {
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
                    aria-label={t("templates.newFromContract.removeFile", {
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
                      ? t("templates.newFromContract.extracting", {
                          defaultValue: "Extracting…",
                        })
                      : t("templates.newFromContract.extract", {
                          defaultValue: "Extract template with AI",
                        })}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {extracted.warnings.length > 0 && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-amber-ink">
                  <AlertTriangle className="me-1 inline-block h-3 w-3" />
                  {t("templates.newFromContract.reviewWarnings", {
                    defaultValue: "Review the warnings",
                  })}
                </div>
                <ul className="space-y-1 text-xs text-amber-ink">
                  {extracted.warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="rounded-md border border-sage/30 bg-sage-tint/40 px-3 py-2 text-xs text-sage-ink">
            {t("templates.newFromContract.step2", {
              defaultValue:
                "Step 2 — Review the redacted body + placeholder catalog below. Edit anything that the AI missed, then save.",
            })}
          </div>

          <TemplateEditorForm
            initial={{
              nameEn: extracted.nameEn,
              descriptionEn: extracted.descriptionEn,
              contractType: extracted.contractType,
              language: extracted.language,
              regulatoryReference: extracted.regulatoryReference,
              bodyEn: extracted.bodyEnRedacted,
              placeholders: extracted.placeholders,
            }}
            submitLabel={t("templates.actions.save", { defaultValue: "Save template" })}
            isSubmitting={createMutation.isPending}
            onCancel={() => {
              setExtracted(null);
              setFile(null);
            }}
            onSubmit={async (input) => {
              const created = await createMutation.mutateAsync(input);
              void navigate({
                to: "/app/templates/$id",
                params: { id: String(created.id) },
              });
            }}
          />
        </>
      )}
    </div>
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
    labelKey: "templates.newFromContract.progress.reading",
    defaultLabel: "Reading file",
  },
  {
    key: "uploading",
    labelKey: "templates.newFromContract.progress.uploading",
    defaultLabel: "Sending document to AI",
  },
  {
    key: "analyzing",
    labelKey: "templates.newFromContract.progress.analyzing",
    defaultLabel: "AI analyzing structure and entities",
  },
  {
    key: "building",
    labelKey: "templates.newFromContract.progress.building",
    defaultLabel: "Building placeholder catalog",
  },
];

function ExtractionProgress({ step }: { step: number }) {
  const { t } = useTranslation();
  // step is 1..4 while pending; cap at PROGRESS_STEPS.length while we wait
  // for the server response. Render the active step + checkmarks for the
  // ones already passed.
  const activeIdx = Math.max(0, Math.min(PROGRESS_STEPS.length, step) - 1);
  const pct = ((activeIdx + 1) / PROGRESS_STEPS.length) * 100;

  return (
    <div className="rounded-md border border-gold/30 bg-gold/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          {t("templates.newFromContract.progressTitle", {
            defaultValue: "Extracting template",
          })}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
          {t("templates.newFromContract.progressHint", {
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
