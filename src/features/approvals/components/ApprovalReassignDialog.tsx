/**
 * ApprovalReassignDialog (S8) — admin force-reassigns a stalled pending step.
 *
 * Distinct from S3 (delegate is voluntary, by the assigned approver).
 * Reassign is admin override — endpoint POST /api/v1/admin/approval-steps/
 * :stepId/reassign requires permission `approval.reassign`.
 *
 * AC mapping:
 *   AC-S8-01 / AC-S8-02 — POST sets approver_user_id + reassigned_to.
 *   AC-S8-03 — step.status remains 'pending' post-reassign.
 *   AC-S8-04 — server returns 409 for non-pending steps; surfaced via
 *              translateApiError.
 *   AC-S8-05 — server validates target user role; surfaced via 400.
 *
 * 13-checklist mapping:
 *   T1/T2 — service through approvalChainsService + React Query.
 *   T3    — every label uses t().
 *   T6    — useFocusTrap + Esc-close.
 *   T8    — submit guarded by useDoubleSubmitLock.
 *   T9    — destructive copy: AlertCircle warning before confirming.
 *   T13   — decisionNote sensitive; cleared on close.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { useReassignApproval } from "@/features/approvals/hooks/useApprovals";
import { cn } from "@/lib/utils";

interface Props {
  stepId: number;
  /** Display-only — shown in the header for context. */
  contractNumber?: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ApprovalReassignDialog({
  stepId,
  contractNumber,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const userId = useId();
  const noteId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  const [reassignedToUserId, setReassignedToUserId] = useState<string>("");
  const [note, setNote] = useState("");

  const lock = useDoubleSubmitLock();
  const mutation = useReassignApproval({
    onSuccess: () => {
      reset();
      onSuccess?.();
      onClose();
    },
    onSettled: () => lock.release(),
  });

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    setReassignedToUserId("");
    setNote("");
    const handle = window.setTimeout(() => firstFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mutation.isPending, onClose]);

  if (!open) return null;

  const reset = () => {
    setReassignedToUserId("");
    setNote("");
  };

  const parsed = reassignedToUserId ? Number(reassignedToUserId) : NaN;
  const userIdValid = Number.isFinite(parsed) && parsed > 0;

  const canSubmit =
    userIdValid && !mutation.isPending && !lock.isLocked();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!lock.acquire()) return;
    const trimmedNote = note.trim();
    mutation.mutate({
      stepId,
      data: {
        reassignedToUserId: parsed,
        decisionNote: trimmedNote === "" ? undefined : trimmedNote,
      },
    });
  };

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
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {t("approval.reassign.title")}
            </h2>
            {contractNumber && (
              <p className="mt-1 text-sm text-ink-muted">
                {t("approval.reassign.description", { number: contractNumber })}
              </p>
            )}
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

        <div className="mt-3 flex gap-2 rounded-md border border-amber/40 bg-amber-tint/40 p-3 text-[11px] text-amber-ink">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          <span>{t("approval.reassign.warning")}</span>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
          <div>
            <label
              htmlFor={userId}
              className="block text-xs font-medium text-ink-muted"
            >
              {t("approval.reassign.targetUser")}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </label>
            <input
              id={userId}
              ref={firstFocusRef}
              type="number"
              inputMode="numeric"
              min={1}
              value={reassignedToUserId}
              onChange={(e) => setReassignedToUserId(e.target.value)}
              disabled={mutation.isPending}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              placeholder={t("approval.reassign.targetUserPlaceholder")}
              aria-describedby={`${userId}-help`}
            />
            <p id={`${userId}-help`} className="mt-1 text-[11px] text-ink-subtle">
              {t("approval.reassign.targetUserHelp")}
            </p>
          </div>
          <div>
            <label
              htmlFor={noteId}
              className="block text-xs font-medium text-ink-muted"
            >
              {t("approval.reassign.noteOptional")}
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={mutation.isPending}
              rows={3}
              placeholder={t("approval.reassign.notePlaceholder")}
              className={cn(
                "mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending
                ? t("common.saving")
                : t("approval.reassign.confirm")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ApprovalReassignDialog;
