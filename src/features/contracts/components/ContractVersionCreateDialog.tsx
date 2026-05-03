/**
 * ContractVersionCreateDialog (S10) — save the current body as a new version.
 *
 * Mode: harden — save-as-version slice of the Lovable VersionCompareDialog
 * (the comparison + AI diff features are M4).
 *
 * AC mapping:
 *   AC-S10-01 — POST /api/v1/contracts/:id/versions; server atomically
 *               increments version_number.
 *   AC-S10-04 — at least one of bodyEn / bodyAr required (client-side).
 *   AC-S10-05 — changeNote required.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useCreateContractVersion } from "@/features/contracts/hooks/useContracts";
import { cn } from "@/lib/utils";

interface ContractVersionCreateDialogProps {
  contractId: number;
  open: boolean;
  onClose: () => void;
}

export function ContractVersionCreateDialog({
  contractId,
  open,
  onClose,
}: ContractVersionCreateDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const noteId = useId();
  const summaryId = useId();
  const bodyEnId = useId();
  const bodyArId = useId();
  const noteRef = useRef<HTMLInputElement>(null);
  // M1b — FE-C4 focus-trap container ref.
  const dialogRef = useRef<HTMLDivElement>(null);

  const [changeNote, setChangeNote] = useState("");
  const [diffSummary, setDiffSummary] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [error, setError] = useState<string | null>(null);

  // M1b — apply shared focus-trap (FE-C4 deferred from M1a).
  useFocusTrap(dialogRef, open);

  const mutation = useCreateContractVersion({
    onSuccess: () => onClose(),
  });

  useEffect(() => {
    if (!open) return;
    setChangeNote("");
    setDiffSummary("");
    setBodyEn("");
    setBodyAr("");
    setError(null);
    const handle = window.setTimeout(() => noteRef.current?.focus(), 0);
    // FE-C1 (Codex): also scrub sensitive body fields when the dialog
    // closes (open flips back to false) AND on full unmount of the host
    // component, so body text never lingers after the user dismisses
    // the dialog or navigates away from the detail page.
    return () => {
      window.clearTimeout(handle);
      setBodyEn("");
      setBodyAr("");
      setChangeNote("");
      setDiffSummary("");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mutation.isPending, onClose]);

  // FE-C1 (Codex): unconditional unmount cleanup. The open-keyed effect
  // only runs cleanup when `open` flips; when the host page unmounts while
  // the dialog is closed, this guarantees state is still scrubbed.
  useEffect(() => {
    return () => {
      setBodyEn("");
      setBodyAr("");
      setChangeNote("");
      setDiffSummary("");
    };
  }, []);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (changeNote.trim() === "") {
      setError(t("contracts.versions.errors.changeNoteRequired"));
      return;
    }
    if (bodyEn.trim() === "" && bodyAr.trim() === "") {
      setError(t("contracts.versions.errors.bodyRequired"));
      return;
    }
    mutation.mutate({
      id: contractId,
      data: {
        changeNote: changeNote.trim(),
        diffSummary: diffSummary.trim() === "" ? null : diffSummary.trim(),
        bodyEn: bodyEn.trim() === "" ? null : bodyEn,
        bodyAr: bodyAr.trim() === "" ? null : bodyAr,
      },
    });
  };

  const textareaClass = cn(
    "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {t("contracts.versions.dialogTitle")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t("contracts.versions.dialogDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor={noteId} className="block text-xs font-medium text-ink-muted">
              {t("contracts.versions.changeNoteLabel")}
              <span className="ms-1 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <Input
              id={noteId}
              ref={noteRef}
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              disabled={mutation.isPending}
              maxLength={500}
              required
              className="mt-1"
            />
          </div>

          <div>
            <label htmlFor={summaryId} className="block text-xs font-medium text-ink-muted">
              {t("contracts.versions.diffSummaryLabel")}
            </label>
            <textarea
              id={summaryId}
              value={diffSummary}
              onChange={(e) => setDiffSummary(e.target.value)}
              disabled={mutation.isPending}
              rows={2}
              className={cn(textareaClass, "mt-1")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={bodyEnId} className="block text-xs font-medium text-ink-muted">
                {t("contracts.fields.bodyEn")}
              </label>
              <textarea
                id={bodyEnId}
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                disabled={mutation.isPending}
                rows={6}
                className={cn(textareaClass, "mt-1")}
              />
            </div>
            <div>
              <label htmlFor={bodyArId} className="block text-xs font-medium text-ink-muted">
                {t("contracts.fields.bodyAr")}
              </label>
              <textarea
                id={bodyArId}
                value={bodyAr}
                onChange={(e) => setBodyAr(e.target.value)}
                disabled={mutation.isPending}
                rows={6}
                dir="rtl"
                className={cn(textareaClass, "mt-1")}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-terracotta/40 bg-terracotta-tint/40 px-3 py-2 text-[11px] font-medium text-terracotta-ink"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("common.saving") : t("contracts.versions.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContractVersionCreateDialog;
