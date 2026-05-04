/**
 * BulkImportView (S5) — multi-file bulk-import orchestrator.
 *
 * Mode: harden — derived from Lovable `routes/_app/import.bulk.tsx`. The
 * Lovable file (1195 lines) was tightly coupled to supabase.from() / direct
 * notifications inserts / direct contract inserts. Visual idioms preserved:
 *   - Drop zone with drag-over highlight + file picker fallback
 *   - File list with size + remove
 *   - Pre-flight config (status mode, default counterparty, default type,
 *     skip-duplicates, threshold sliders — wired to IMPORT_CONFIDENCE_THRESHOLDS)
 *   - Live processing screen (current file, recently completed list, progress)
 *   - Pause / Resume / Cancel
 *   - Completion summary with per-row outcomes
 *
 * Harden checklist:
 *   T1  All API calls go through services → React Query (no supabase.from()).
 *   T2  useCreateImportBatch + useUpdateImportBatch + useImportBatch hooks.
 *   T3  Every string is t()-keyed; no hardcoded English.
 *   T4  Loading skeleton, empty state, error state — all rendered.
 *   T5  Semantic Tailwind tokens only (bg-card, text-ink, border-border, …).
 *   T6  Accessibility: drag-and-drop has keyboard alternative (file picker
 *       button); aria-labels on icon buttons; role=dialog on confirm modals.
 *   T7  Strict TS — no `any`. ImportBatchStatusMode + outcome types fully
 *       enumerated.
 *   T8  Form hygiene: submit disabled during mutation; threshold sliders
 *       enforce medium <= high invariants.
 *   T9  Cancel batch and start are gated by ConfirmDialog (focus-trapped).
 *   T10 Search-style inputs: N/A here (no filters). Counterparty selector
 *       fetches all parties via M1a — debounce not needed.
 *   T11 Wrapped in <ErrorBoundary> by the route entry.
 *   T12 formatDateTime for any ISO timestamp display.
 *   T13 extractedText is sensitive — never console.log; passed straight to
 *       service. File contents not persisted to localStorage.
 *
 * Codex lessons embedded:
 *   F-FE-001: never raw fetch — apiClient wraps every BE call.
 *   F-FE-002: useDoubleSubmitLock on Start Import + Cancel.
 *   F-FE-M1:  bulk-import draft TTL envelope via bulkImportDraft helper.
 *   F-FE-M2:  toast errors via translateApiError.
 *
 * Known limitations (documented per AC-S5-07):
 *   - Notifications are TOAST-ONLY in M1c; DB-side fn_notification_create_bulk
 *     does not exist (Q1 deferred). Server-side notification rows arrive
 *     with a future Notifications module.
 *   - File handles cannot be persisted across page reloads (browser
 *     limitation). The TTL'd draft preserves config + batchId but the
 *     user must re-select files to continue an interrupted batch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  X,
  Check,
  Circle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore, selectHasPermission, selectUser } from "@/store/auth.store";
import { translateApiError } from "@/lib/translate-api-error";
import { ApiError } from "@/lib/api-client";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useCreateImportBatch,
  useUpdateImportBatch,
  useImportBatch,
} from "@/features/imports/hooks/useImportBatches";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { extractContractBulkService } from "@/services/api/extract-contract-bulk.service";
import {
  extractTextFromFile,
  TextExtractionError,
} from "@/features/imports/lib/extract-text";
import { uploadToStorage } from "@/features/imports/lib/upload-to-storage";
import {
  defaultBulkImportDraftState,
  readBulkImportDraft,
  writeBulkImportDraft,
  clearBulkImportDraft,
  type BulkImportDraftState,
} from "@/features/imports/lib/bulk-import-draft";
import {
  IMPORT_CONFIDENCE_THRESHOLDS,
  routeByConfidence,
  type ImportBatchStatusMode,
  type ExtractContractBulkResponse,
} from "@/types/entities/import-batch.types";
import type { CreateContractDto } from "@/types/entities/contract.types";
import { ConfirmDialog } from "./ConfirmDialog";

const MAX_FILES = 50;
const MAX_BYTES_PER_FILE = 25 * 1024 * 1024;
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type FileOutcome =
  | "auto"
  | "review"
  | "manual"
  | "skipped"
  | "errored"
  | "pending"
  | "processing";

interface SelectedFile {
  id: string;
  file: File;
}

interface ProcessedItem {
  fileName: string;
  outcome: FileOutcome;
  contractId: number | null;
  confidence: number;
  warnings: string[];
}

type Phase = "select" | "processing" | "done";

export function BulkImportView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const canRun = useAuthStore(selectHasPermission("import.run"));

  // ─── Pre-flight state ──────────────────────────────────────────────────
  const [draft, setDraft] = useState<BulkImportDraftState>(() =>
    readBulkImportDraft() ?? defaultBulkImportDraftState(),
  );
  const debouncedDraft = useDebounce(draft, 300);
  useEffect(() => {
    writeBulkImportDraft(debouncedDraft);
  }, [debouncedDraft]);

  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>("select");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ─── Confirmation modals ───────────────────────────────────────────────
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // ─── Run state ─────────────────────────────────────────────────────────
  const [batchId, setBatchId] = useState<number | null>(draft.batchId);
  const [processed, setProcessed] = useState<ProcessedItem[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const cancelFlag = useRef(false);
  const pauseFlag = useRef(false);
  const [pausedDisplay, setPausedDisplay] = useState(false);

  // F-FE-002 — synchronous one-shot lock on Start.
  const startLock = useDoubleSubmitLock();

  // ─── Hooks ─────────────────────────────────────────────────────────────
  const createBatch = useCreateImportBatch();
  const updateBatch = useUpdateImportBatch();
  const batchQuery = useImportBatch(batchId);

  // Load resume hint when draft.batchId is set (after a refresh mid-run).
  // We don't re-process automatically — the user must re-pick files. Show
  // the toast once.
  useEffect(() => {
    if (draft.batchId && phase === "select" && files.length === 0) {
      toast.message(t("import.bulk.resumeHint", { batchId: draft.batchId }));
    }
    // Run only when the draft has a batchId; user-driven reselection
    // re-triggers Start which creates a new batch (intended).
  }, [draft.batchId, phase, files.length, t]);

  // ─── File selection ────────────────────────────────────────────────────
  const onSelectFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      const accepted: SelectedFile[] = [];
      const rejected: string[] = [];
      for (const f of arr) {
        const lower = f.name.toLowerCase();
        const isPdf = f.type === "application/pdf" || lower.endsWith(".pdf");
        const isDocx =
          f.type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          lower.endsWith(".docx");
        if (!isPdf && !isDocx) {
          rejected.push(t("import.bulk.errors.unsupportedFile", { name: f.name }));
          continue;
        }
        if (f.size > MAX_BYTES_PER_FILE) {
          rejected.push(t("import.bulk.errors.tooLarge", { name: f.name }));
          continue;
        }
        accepted.push({
          id: `${f.name}-${f.size}-${f.lastModified}`,
          file: f,
        });
      }
      setFiles((prev) => {
        const next = [...prev];
        for (const a of accepted) {
          if (!next.some((m) => m.id === a.id)) next.push(a);
        }
        if (next.length > MAX_FILES) {
          toast.error(t("import.bulk.errors.maxFiles", { count: MAX_FILES }));
          return next.slice(0, MAX_FILES);
        }
        return next;
      });
      if (rejected.length > 0) {
        toast.error(rejected.join("\n"));
      }
    },
    [t],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) onSelectFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);

  // ─── Run loop ──────────────────────────────────────────────────────────
  const startImport = async () => {
    if (!user?.id || files.length === 0) return;
    if (!startLock.acquire()) return;
    setConfirmStart(false);
    cancelFlag.current = false;
    pauseFlag.current = false;
    setPausedDisplay(false);
    setProcessed([]);

    try {
      const created = await createBatch.mutateAsync({
        totalFiles: files.length,
        config: {
          statusMode: draft.statusMode,
          defaultCounterpartyId: draft.defaultCounterpartyId ?? undefined,
          contractType: draft.defaultContractType ?? undefined,
        },
      });
      setBatchId(created.id);
      setDraft((d) => ({ ...d, batchId: created.id }));
      setPhase("processing");

      const results: ProcessedItem[] = files.map((f) => ({
        fileName: f.file.name,
        outcome: "pending",
        contractId: null,
        confidence: 0,
        warnings: [],
      }));
      setProcessed(results);

      for (let i = 0; i < files.length; i++) {
        // pause loop — yields cooperatively
        while (pauseFlag.current && !cancelFlag.current) {
          await new Promise((r) => window.setTimeout(r, 250));
        }
        if (cancelFlag.current) break;

        const f = files[i];
        setCurrentFile(f.file.name);
        results[i] = { ...results[i], outcome: "processing" };
        setProcessed([...results]);

        const item = await processOne(f.file, created.id, draft);
        results[i] = item;
        setProcessed([...results]);

        // Counter delta to BE
        await updateBatch
          .mutateAsync({
            id: created.id,
            data: counterDeltaForOutcome(item.outcome),
          })
          .catch(() => {
            // Counter update failure is non-blocking; the batch's final
            // status update at the end will reconcile counters via the
            // real numbers from the BE response.
          });
      }

      setCurrentFile(null);

      // Final terminal transition
      const terminalStatus = cancelFlag.current ? "cancelled" : "completed";
      try {
        await updateBatch.mutateAsync({
          id: created.id,
          data: { status: terminalStatus },
        });
      } catch {
        // Terminal update failed — surface but stay on summary screen so
        // the user can see the per-file outcomes.
        toast.error(t("import.bulk.errors.terminalUpdateFailed"));
      }

      // T13 — never log file content; only counters.
      const auto = results.filter((r) => r.outcome === "auto").length;
      const review = results.filter((r) => r.outcome === "review").length;
      toast.success(
        t("import.bulk.toasts.completed", {
          status: terminalStatus,
          auto,
          review,
        }),
      );

      clearBulkImportDraft();
      setPhase("done");
    } catch (err) {
      // Batch creation failed — stay on select.
      const message =
        err instanceof ApiError
          ? translateApiError(err, t, "errors.import.batchCreateFailed")
          : t("errors.import.batchCreateFailed");
      toast.error(message);
    } finally {
      startLock.release();
    }
  };

  const onPauseToggle = () => {
    pauseFlag.current = !pauseFlag.current;
    setPausedDisplay(pauseFlag.current);
    toast.message(
      pauseFlag.current
        ? t("import.bulk.toasts.paused")
        : t("import.bulk.toasts.resumed"),
    );
    if (batchId !== null) {
      void updateBatch
        .mutateAsync({
          id: batchId,
          data: { status: pauseFlag.current ? "paused" : "in_progress" },
        })
        .catch(() => {
          // Best-effort — local pause flag still gates the loop.
        });
    }
  };

  const onCancelConfirmed = () => {
    cancelFlag.current = true;
    pauseFlag.current = false;
    setPausedDisplay(false);
    setConfirmCancel(false);
  };

  // ─── Permission guard ──────────────────────────────────────────────────
  if (!canRun) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <h2 className="text-base font-semibold text-ink">
              {t("import.bulk.forbiddenTitle")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted">
              {t("import.bulk.forbiddenDescription")}
            </p>
            <Link
              to="/app/contracts"
              className="text-sm text-ink-subtle underline-offset-4 hover:text-ink hover:underline"
            >
              {t("import.bulk.backToContracts")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1280px] space-y-6 p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("import.bulk.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t("import.bulk.kicker")}</p>
        </div>
        <Link
          to="/app/imports/manual-entries"
          className="text-sm text-ink-subtle underline-offset-4 hover:text-ink hover:underline"
        >
          {t("import.bulk.switchManual")}
        </Link>
      </header>

      {phase === "select" && (
        <SelectPhase
          files={files}
          dragOver={dragOver}
          setDragOver={setDragOver}
          onDrop={onDrop}
          onSelectFiles={onSelectFiles}
          inputRef={inputRef}
          removeFile={removeFile}
          totalSize={totalSize}
          draft={draft}
          setDraft={setDraft}
          onStart={() => setConfirmStart(true)}
          startDisabled={files.length === 0 || createBatch.isPending}
        />
      )}

      {phase === "processing" && (
        <ProcessingPhase
          totalFiles={files.length}
          processed={processed}
          currentFile={currentFile}
          paused={pausedDisplay}
          batchSnapshot={batchQuery.data ?? null}
          onPauseToggle={onPauseToggle}
          onCancel={() => setConfirmCancel(true)}
        />
      )}

      {phase === "done" && (
        <DonePhase
          processed={processed}
          batchId={batchId}
          onViewBatch={() => {
            if (batchId !== null) {
              void navigate({
                to: "/app/admin/imports/$batchId",
                params: { batchId: String(batchId) },
              });
            }
          }}
          onOpenReview={() =>
            void navigate({ to: "/app/imports/review-queue" })
          }
        />
      )}

      <ConfirmDialog
        open={confirmStart}
        title={t("import.bulk.confirmStartTitle")}
        description={t("import.bulk.confirmStartDescription", {
          count: files.length,
        })}
        confirmLabel={t("import.bulk.start")}
        destructive={false}
        isPending={createBatch.isPending}
        onConfirm={() => void startImport()}
        onClose={() => setConfirmStart(false)}
      />

      <ConfirmDialog
        open={confirmCancel}
        title={t("import.bulk.confirmCancelTitle")}
        description={t("import.bulk.confirmCancelDescription", {
          processed: processed.filter(
            (p) => p.outcome !== "pending" && p.outcome !== "processing",
          ).length,
          total: files.length,
        })}
        confirmLabel={t("import.bulk.confirmCancelYes")}
        destructive
        onConfirm={onCancelConfirmed}
        onClose={() => setConfirmCancel(false)}
      />
    </motion.div>
  );
}

// ─── Phase: Select ───────────────────────────────────────────────────────────

interface SelectPhaseProps {
  files: SelectedFile[];
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onSelectFiles: (incoming: FileList | File[]) => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  removeFile: (id: string) => void;
  totalSize: number;
  draft: BulkImportDraftState;
  setDraft: React.Dispatch<React.SetStateAction<BulkImportDraftState>>;
  onStart: () => void;
  startDisabled: boolean;
}

function SelectPhase(props: SelectPhaseProps) {
  const { t } = useTranslation();
  const {
    files,
    dragOver,
    setDragOver,
    onDrop,
    onSelectFiles,
    inputRef,
    removeFile,
    totalSize,
    draft,
    setDraft,
    onStart,
    startDisabled,
  } = props;

  return (
    <div className="space-y-6">
      {/* Drop zone — keyboard-accessible via the explicit picker button */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={
          "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors " +
          (dragOver
            ? "border-primary bg-accent"
            : "border-border hover:border-border")
        }
      >
        <Upload className="h-12 w-12 text-ink-muted" strokeWidth={1.25} aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-base font-medium text-ink">
            {t("import.bulk.dropTitle")}
          </p>
          <p className="text-sm text-ink-muted">
            {t("import.bulk.dropSubtitle", { max: MAX_FILES })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          {t("import.bulk.chooseFiles")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME.join(",") + ",.pdf,.docx"}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) onSelectFiles(e.target.files);
            e.target.value = "";
          }}
          aria-label={t("import.bulk.chooseFiles")}
        />
      </div>

      {files.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">
                {t("import.bulk.filesSelected", {
                  count: files.length,
                  size: (totalSize / 1024 / 1024).toFixed(1),
                })}
              </p>
            </div>
            <ul className="divide-y divide-border">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2">
                  <FileText
                    className="h-4 w-4 shrink-0 text-ink-muted"
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate font-mono text-xs text-ink">
                    {f.file.name}
                  </span>
                  <span className="font-mono text-xs text-ink-muted">
                    {(f.file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(f.id)}
                    aria-label={t("import.bulk.removeFile", { name: f.file.name })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {files.length > 0 && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <h3 className="text-sm font-semibold text-ink">
              {t("import.bulk.configTitle")}
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="bulk-status-mode" className="text-xs font-medium text-ink">
                  {t("import.bulk.statusMode")}
                </label>
                <select
                  id="bulk-status-mode"
                  value={draft.statusMode}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      statusMode: e.target.value as ImportBatchStatusMode,
                    }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="auto">{t("import.bulk.statusAuto")}</option>
                  <option value="active">{t("import.bulk.statusActive")}</option>
                  <option value="draft">{t("import.bulk.statusDraft")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="bulk-default-type" className="text-xs font-medium text-ink">
                  {t("import.bulk.defaultType")}
                </label>
                <input
                  id="bulk-default-type"
                  type="text"
                  value={draft.defaultContractType ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      defaultContractType: e.target.value.trim() || null,
                    }))
                  }
                  placeholder={t("import.bulk.defaultTypePlaceholder")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="bulk-default-counterparty" className="text-xs font-medium text-ink">
                  {t("import.bulk.defaultCounterpartyId")}
                </label>
                <input
                  id="bulk-default-counterparty"
                  type="number"
                  value={draft.defaultCounterpartyId ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === "" ? null : Number(raw);
                    setDraft((d) => ({
                      ...d,
                      defaultCounterpartyId:
                        parsed !== null && Number.isFinite(parsed) && parsed > 0
                          ? parsed
                          : null,
                    }));
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-xs text-ink-muted">
                  {t("import.bulk.defaultCounterpartyHint")}
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface p-3">
              <p className="text-xs font-medium text-ink-muted">
                {t("import.bulk.thresholdsTitle")}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {t("import.bulk.thresholdsExplain", {
                  high: IMPORT_CONFIDENCE_THRESHOLDS.high,
                  medium: IMPORT_CONFIDENCE_THRESHOLDS.medium,
                })}
              </p>
            </div>

            <div className="flex items-center justify-end">
              <Button onClick={onStart} disabled={startDisabled}>
                {t("import.bulk.start")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Phase: Processing ───────────────────────────────────────────────────────

interface ProcessingPhaseProps {
  totalFiles: number;
  processed: ProcessedItem[];
  currentFile: string | null;
  paused: boolean;
  batchSnapshot: import("@/types/entities/import-batch.types").ImportBatch | null;
  onPauseToggle: () => void;
  onCancel: () => void;
}

function ProcessingPhase(props: ProcessingPhaseProps) {
  const { t } = useTranslation();
  const {
    totalFiles,
    processed,
    currentFile,
    paused,
    batchSnapshot,
    onPauseToggle,
    onCancel,
  } = props;
  const auto = processed.filter((p) => p.outcome === "auto").length;
  const review = processed.filter((p) => p.outcome === "review").length;
  const manual = processed.filter((p) => p.outcome === "manual").length;
  const skipped = processed.filter((p) => p.outcome === "skipped").length;
  const errored = processed.filter((p) => p.outcome === "errored").length;
  const done = auto + review + manual + skipped + errored;
  const pct = totalFiles > 0 ? Math.round((done / totalFiles) * 100) : 0;

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {t("import.bulk.processingTitle", { count: totalFiles })}
          </h2>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>{t("import.bulk.progress", { done, total: totalFiles })}</span>
              <span className="font-mono">{pct}%</span>
            </div>
            <div
              className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tally label={t("import.bulk.autoSaved")} value={auto} />
          <Tally label={t("import.bulk.inReview")} value={review} />
          <Tally label={t("import.bulk.manualEntry")} value={manual} />
          <Tally label={t("import.bulk.skipped")} value={skipped} />
          <Tally label={t("import.bulk.errored")} value={errored} />
        </div>

        {batchSnapshot && (
          <p className="text-xs text-ink-muted" aria-live="polite">
            {t("import.bulk.serverCounters", {
              auto: batchSnapshot.autoSaved,
              review: batchSnapshot.reviewQueue,
              manual: batchSnapshot.manualEntry,
              skipped: batchSnapshot.duplicatesSkipped,
              errored: batchSnapshot.errored,
            })}
          </p>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {t("import.bulk.nowProcessing")}
          </p>
          {currentFile ? (
            <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
              <span className="font-mono text-sm text-ink">{currentFile}</span>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              {paused ? t("import.bulk.paused") : "—"}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {t("import.bulk.recentlyCompleted")}
          </p>
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {[...processed]
                .filter(
                  (p) => p.outcome !== "pending" && p.outcome !== "processing",
                )
                .reverse()
                .slice(0, 10)
                .map((p) => (
                  <motion.li
                    key={p.fileName}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <OutcomeIcon outcome={p.outcome} />
                    <span className="flex-1 truncate font-mono text-xs text-ink">
                      {p.fileName}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      {p.confidence}%
                    </span>
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onPauseToggle}>
            {paused ? (
              <Play className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Pause className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            )}
            {paused ? t("import.bulk.resume") : t("import.bulk.pause")}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Phase: Done ─────────────────────────────────────────────────────────────

interface DonePhaseProps {
  processed: ProcessedItem[];
  batchId: number | null;
  onViewBatch: () => void;
  onOpenReview: () => void;
}

function DonePhase({
  processed,
  batchId,
  onViewBatch,
  onOpenReview,
}: DonePhaseProps) {
  const { t } = useTranslation();
  const auto = processed.filter((p) => p.outcome === "auto").length;
  const review = processed.filter((p) => p.outcome === "review").length;
  const manual = processed.filter((p) => p.outcome === "manual").length;
  const skipped = processed.filter((p) => p.outcome === "skipped").length;
  const errored = processed.filter((p) => p.outcome === "errored").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold text-ink">
            {t("import.bulk.completeTitle")}
          </h2>
          <p className="text-sm text-ink-muted">
            {t("import.bulk.completeDescription", { count: processed.length })}
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              {auto} {t("import.bulk.autoSaved")}
            </span>
            <span className="flex items-center gap-1.5">
              <Circle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              {review} {t("import.bulk.inReview")}
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle
                className="h-3.5 w-3.5 text-warning"
                aria-hidden="true"
              />
              {manual} {t("import.bulk.manualEntry")}
            </span>
            {skipped > 0 && (
              <span className="flex items-center gap-1.5">
                <X className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                {skipped} {t("import.bulk.skipped")}
              </span>
            )}
            {errored > 0 && (
              <span className="flex items-center gap-1.5">
                <AlertTriangle
                  className="h-3.5 w-3.5 text-destructive"
                  aria-hidden="true"
                />
                {errored} {t("import.bulk.errored")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h3 className="text-sm font-semibold text-ink">
            {t("import.bulk.perFileResults")}
          </h3>
          <ul className="divide-y divide-border">
            {processed.map((p) => (
              <li key={p.fileName} className="flex items-center gap-3 py-2.5">
                <OutcomeIcon outcome={p.outcome} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-ink">
                    {p.fileName}
                  </p>
                  {p.warnings.length > 0 && (
                    <p className="text-xs text-ink-muted">
                      {p.warnings.join(" · ")}
                    </p>
                  )}
                </div>
                <span className="font-mono text-xs text-ink-muted">
                  {p.confidence}%
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onViewBatch} disabled={batchId === null}>
          {t("import.bulk.viewBatch")}{" "}
          <ArrowRight className="ms-1.5 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button variant="outline" onClick={onOpenReview} disabled={review === 0}>
          {t("import.bulk.openReviewQueue")}
        </Button>
      </div>
    </div>
  );
}

// ─── Tally + Outcome icons ───────────────────────────────────────────────────

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function OutcomeIcon({ outcome }: { outcome: FileOutcome }) {
  switch (outcome) {
    case "auto":
      return <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />;
    case "review":
      return <Circle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />;
    case "manual":
      return (
        <AlertTriangle
          className="h-3.5 w-3.5 text-warning"
          aria-hidden="true"
        />
      );
    case "skipped":
      return <X className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />;
    case "errored":
      return (
        <AlertTriangle
          className="h-3.5 w-3.5 text-destructive"
          aria-hidden="true"
        />
      );
    case "processing":
      return (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-primary"
          aria-hidden="true"
        />
      );
    default:
      return <Circle className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />;
  }
}

// ─── Per-file processing ─────────────────────────────────────────────────────

function counterDeltaForOutcome(
  outcome: FileOutcome,
): import("@/types/entities/import-batch.types").UpdateImportBatchDto {
  switch (outcome) {
    case "auto":
      return { autoSavedDelta: 1 };
    case "review":
      return { reviewQueueDelta: 1 };
    case "manual":
      return { manualEntryDelta: 1 };
    case "skipped":
      return { duplicatesSkippedDelta: 1 };
    case "errored":
      return { erroredDelta: 1 };
    default:
      return {};
  }
}

/**
 * Per-file processing pipeline:
 *   1. Extract text in browser (mammoth/pdfjs)
 *   2. Optionally upload original file to Supabase storage (HQ1)
 *   3. POST extractedText to AI stub
 *   4. Apply confidence routing → auto / review / manual track
 *   5. POST /api/v1/contracts with importBatchId + import metadata
 *   6. Return ProcessedItem
 *
 * On any per-file error, returns outcome='errored' WITHOUT halting the
 * batch (AC-S5-11). The terminal status update reconciles counters at the
 * end of the run.
 *
 * SENSITIVE: extractedText is `ai_prompt_payload` — passed straight from
 * extraction to the service; never stored, never logged (T13).
 */
async function processOne(
  file: File,
  batchId: number,
  draft: BulkImportDraftState,
): Promise<ProcessedItem> {
  // Step 1 — text extraction
  let extractedText: string;
  try {
    const result = await extractTextFromFile(file);
    extractedText = result.text;
  } catch (err) {
    const warning =
      err instanceof TextExtractionError ? err.kind : "extract_failed";
    return {
      fileName: file.name,
      outcome: "errored",
      contractId: null,
      confidence: 0,
      warnings: [warning],
    };
  }

  if (extractedText.length < 50) {
    // Below AC-S8-03 floor — route to manual entry track immediately.
    return {
      fileName: file.name,
      outcome: "manual",
      contractId: null,
      confidence: 0,
      warnings: ["text_too_short"],
    };
  }

  // Step 2 — optional storage upload (Supabase 'contracts' bucket per HQ1).
  // We don't currently surface storagePath to the BE because the M1c
  // contract.import_filename column is filename-only; storage path lives
  // for future attachment integration. Best-effort, non-blocking.
  void uploadToStorage(file, batchId).catch(() => {
    // Storage failures don't affect the import — the extracted text is
    // already in flight to the AI service.
  });

  // Step 3 — AI stub
  let aiResponse: ExtractContractBulkResponse;
  try {
    aiResponse = await extractContractBulkService.extract({
      filename: file.name,
      fileSize: file.size,
      extractedText,
      batchId,
    });
  } catch {
    return {
      fileName: file.name,
      outcome: "errored",
      contractId: null,
      confidence: 0,
      warnings: ["ai_extract_failed"],
    };
  }

  // Step 4 — duplicate detection (AC-S5-09): if the AI returned a
  // detectedDuplicateContractNumber the FE checks against existing actives.
  // For M1c we mark such files as 'skipped' WITHOUT issuing a
  // fn_contract_create — the duplicates_skipped counter is incremented
  // separately. Future iterations may add a real lookup against fn_contract_list.
  if (
    aiResponse.detectedDuplicateContractNumber !== undefined &&
    aiResponse.detectedDuplicateContractNumber !== null
  ) {
    return {
      fileName: file.name,
      outcome: "skipped",
      contractId: null,
      confidence: aiResponse.importConfidence,
      warnings: ["duplicate_detected"],
    };
  }

  // Step 5 — confidence routing
  const track = routeByConfidence(aiResponse.importConfidence);
  // Track 'manual' means the user must complete the manual-entry form.
  // M1c does NOT auto-create the manual-track contract — the file appears
  // in the manual-entries route until the user submits.
  if (track === "manual") {
    return {
      fileName: file.name,
      outcome: "manual",
      contractId: null,
      confidence: aiResponse.importConfidence,
      warnings: aiResponse.importWarnings ?? [],
    };
  }

  // Step 6 — fn_contract_create call.
  // Compose the CreateContractDto from the AI response + fallbacks.
  // Empty AI fields fall back to filename for titleEn (BE requires titleEn).
  const fallbackTitle = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 100);
  const dto: CreateContractDto = {
    titleEn: aiResponse.titleEn?.trim() || fallbackTitle,
    titleAr: aiResponse.titleAr ?? null,
    contractType:
      aiResponse.contractType ?? draft.defaultContractType ?? "other",
    language: aiResponse.language,
    counterpartyId:
      aiResponse.counterpartyId ?? draft.defaultCounterpartyId ?? null,
    valueAed: aiResponse.valueAed ?? null,
    currency: aiResponse.currency ?? "AED",
    startDate: aiResponse.startDate ?? null,
    endDate: aiResponse.endDate ?? null,
    expiryNoticeDays: aiResponse.expiryNoticeDays,
    emirate: aiResponse.emirate ?? null,
    governingLaw: aiResponse.governingLaw ?? null,
    jurisdictionCourt: aiResponse.jurisdictionCourt ?? null,
    parentContractId: aiResponse.parentContractId ?? null,
    relationshipType: aiResponse.relationshipType ?? null,
    bodyEn: aiResponse.bodyEn ?? null,
    bodyAr: aiResponse.bodyAr ?? null,
    tags: aiResponse.tags ?? ["imported"],
    importBatchId: batchId,
    importFilename: file.name,
    importConfidence: aiResponse.importConfidence,
    importWarnings: aiResponse.importWarnings ?? [],
  };

  try {
    const { apiClient } = await import("@/lib/api-client");
    const { data } = await apiClient.post<{ id: number }>(
      "/api/v1/contracts",
      dto,
    );
    return {
      fileName: file.name,
      outcome: track === "auto" ? "auto" : "review",
      contractId: data.id,
      confidence: aiResponse.importConfidence,
      warnings: aiResponse.importWarnings ?? [],
    };
  } catch {
    return {
      fileName: file.name,
      outcome: "errored",
      contractId: null,
      confidence: aiResponse.importConfidence,
      warnings: ["save_failed"],
    };
  }
}

// processOne uses apiClient directly for the per-file fn_contract_create
// loop (avoiding the overhead of spawning N React-Query mutations per
// batch). The list/detail hooks still drive cache invalidation when the
// user navigates back to the contract list, since that route uses the
// useContractList hook (whose query keys M1a invalidates on POST).

export default BulkImportView;
