/**
 * CancelInvitationConfirm (S8) — drafter/legal-counsel-facing modal.
 *
 * Mode: regenerate — no Lovable equivalent (the Lovable repo only had a
 * Decline drawer for the public side; cancel-invitation is a new
 * authenticated-side flow introduced by M3).
 *
 * AC mapping:
 *   AC-S8-04 — destructive confirmation: type-to-confirm gate (signer name
 *              or "CANCEL" depending on UX choice; we use "CANCEL").
 *   AC-S8-06 — reason REQUIRED, non-empty.
 *   AC-S8-03 — permission gate enforced upstream (caller decides whether to
 *              render the trigger button).
 *
 * 13-checklist mapping:
 *   T1/T2 — service via signatureService + React Query mutation.
 *   T3    — every label uses t().
 *   T4    — input states + mutation pending state + lock.
 *   T6    — useFocusTrap + Esc-close.
 *   T8    — submit gated by canSubmit (type-to-confirm + reason).
 *   T9    — destructive: type-to-confirm gate per CLAUDE.md §6 T9.
 *   T13   — reason never console.logged.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { useCancelInvitation } from "@/features/signatures/hooks/useSignatures";
import { cn } from "@/lib/utils";

interface Props {
  invitationId: number;
  /**
   * Signer label (name + side) shown in the warning copy. Optional — when
   * absent, a generic "this invitation" copy is used.
   */
  signerLabel?: string;
  /** Contract id for query invalidation. */
  contractId?: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CONFIRM_KEY = "CANCEL";
const MAX_REASON = 2000;

export function CancelInvitationConfirm({
  invitationId,
  signerLabel,
  contractId,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const reasonId = useId();
  const confirmId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const lock = useDoubleSubmitLock();

  const cancelMutation = useCancelInvitation({
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
    onSettled: () => lock.release(),
  });

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      setReason("");
      setConfirmText("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !cancelMutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cancelMutation.isPending, onClose]);

  if (!open) return null;

  const trimmedReason = reason.trim();
  const reasonValid = trimmedReason.length > 0 && trimmedReason.length <= MAX_REASON;
  const confirmValid = confirmText.trim().toUpperCase() === CONFIRM_KEY;

  const canSubmit =
    reasonValid &&
    confirmValid &&
    !cancelMutation.isPending &&
    !lock.isLocked();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!lock.acquire()) return;
    cancelMutation.mutate({
      invitationId,
      contractId,
      data: { reason: trimmedReason },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !cancelMutation.isPending) onClose();
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
          <h2
            id={titleId}
            className="flex items-center gap-2 text-base font-semibold text-ink"
          >
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
            {t("signatures.cancel.title")}
          </h2>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={cancelMutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-2 text-sm text-ink-muted">
          {signerLabel
            ? t("signatures.cancel.descriptionWithSigner", { signer: signerLabel })
            : t("signatures.cancel.description")}
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
          <div>
            <label
              htmlFor={reasonId}
              className="block text-xs font-medium text-ink-muted"
            >
              {t("signatures.cancel.reasonLabel")}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={cancelMutation.isPending}
              rows={3}
              maxLength={MAX_REASON}
              required
              placeholder={t("signatures.cancel.reasonPlaceholder")}
              className={cn(
                "mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
          </div>

          <div>
            <label
              htmlFor={confirmId}
              className="block text-xs font-medium text-ink-muted"
            >
              {t("signatures.cancel.confirmLabel", { word: CONFIRM_KEY })}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </label>
            <input
              id={confirmId}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={cancelMutation.isPending}
              autoComplete="off"
              spellCheck={false}
              placeholder={CONFIRM_KEY}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              aria-describedby={`${confirmId}-help`}
            />
            <p
              id={`${confirmId}-help`}
              className="mt-1 text-[11px] text-ink-subtle"
            >
              {t("signatures.cancel.confirmHelp", { word: CONFIRM_KEY })}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={cancelMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={!canSubmit}>
              {cancelMutation.isPending
                ? t("common.saving")
                : t("signatures.cancel.confirm")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CancelInvitationConfirm;
