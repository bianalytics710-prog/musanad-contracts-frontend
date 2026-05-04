/**
 * ApprovalDecisionDialog (S2 + S3) — approve / reject / request_resubmission /
 * delegate, in one shared modal.
 *
 * Hardened from Lovable src/components/approvals/ApprovalDecisionDialog.tsx
 * (the original 3-mode approve/reject/request_resubmission dialog) and
 * extended to cover S3 (voluntary delegate) — the BE has separate
 * /decide and /delegate endpoints and we route through the right hook
 * based on the selected action.
 *
 * AC mapping:
 *   AC-S2-01 — POST /approvals/:stepId/decide with { decision, decisionNote }.
 *   AC-S2-02 — decisionNote required for reject (server returns 400 with
 *              field=decisionNote).
 *   AC-S2-03 — decisionNote required for request_resubmission.
 *   AC-S3-01 — POST /approvals/:stepId/delegate with delegatedToUserId.
 *   AC-S3-04 — Cannot delegate to self (BE enforced; FE pre-checks too).
 *
 * 13-checklist mapping:
 *   T1 / T2 — service via approvalService + React Query mutations.
 *   T3      — every label uses t().
 *   T4      — caller owns the open/close lifecycle; while submitting we
 *             surface mutation.isPending on the action button.
 *   T5      — semantic Tailwind tokens only (border / surface / muted /
 *             destructive / amber-tint).
 *   T6      — useFocusTrap + Esc-close + tabIndex=-1 on dialog root.
 *   T7      — ActionKind union; no any.
 *   T8      — submit gated on validation + mutation state + double-submit
 *             lock (F-FE-002).
 *   T9      — destructive actions show AlertCircle warning copy.
 *   T13     — decisionNote is sensitive: never logged; cleared on close.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import {
  useDecideApproval,
  useDelegateApproval,
} from "@/features/approvals/hooks/useApprovals";
import type { DecideKind } from "@/types/entities/approval.types";
import { cn } from "@/lib/utils";

/** UI-level action kind — superset of DecideKind plus 'delegate'. */
export type ApprovalActionKind = DecideKind | "delegate";

interface Props {
  stepId: number;
  /** Optional: pre-select an action when opened from a contextual button. */
  initialKind?: ApprovalActionKind | null;
  /** Currently-signed-in user id — for the AC-S3-04 self-delegate guard. */
  currentUserId?: number | null;
  open: boolean;
  onClose: () => void;
  /** Optional callback after a successful mutation. */
  onSuccess?: () => void;
}

/** Min-length thresholds — match Lovable visual behaviour. */
const MIN_LEN: Record<DecideKind, number> = {
  approve: 0,
  reject: 10,
  request_resubmission: 20,
};

export function ApprovalDecisionDialog({
  stepId,
  initialKind,
  currentUserId,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const noteId = useId();
  const userId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  const [kind, setKind] = useState<ApprovalActionKind | null>(initialKind ?? null);
  const [note, setNote] = useState("");
  const [delegatedToUserId, setDelegatedToUserId] = useState<string>("");

  const lock = useDoubleSubmitLock();
  const decideMutation = useDecideApproval({
    onSuccess: () => {
      reset();
      onSuccess?.();
      onClose();
    },
    onSettled: () => lock.release(),
  });
  const delegateMutation = useDelegateApproval({
    onSuccess: () => {
      reset();
      onSuccess?.();
      onClose();
    },
    onSettled: () => lock.release(),
  });

  const isPending = decideMutation.isPending || delegateMutation.isPending;
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    setKind(initialKind ?? null);
    setNote("");
    setDelegatedToUserId("");
    const handle = window.setTimeout(() => firstFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [open, initialKind]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isPending, onClose]);

  if (!open) return null;

  const reset = () => {
    setNote("");
    setDelegatedToUserId("");
  };

  // ─── Validation ───────────────────────────────────────────────────────────
  const trimmedNote = note.trim();
  const minLen = kind && kind !== "delegate" ? MIN_LEN[kind as DecideKind] : 0;
  const noteTooShort = minLen > 0 && trimmedNote.length < minLen;

  const parsedDelegatedToUserId = delegatedToUserId
    ? Number(delegatedToUserId)
    : NaN;
  const delegateUserIdValid =
    Number.isFinite(parsedDelegatedToUserId) && parsedDelegatedToUserId > 0;
  const delegateNotSelf =
    !currentUserId || parsedDelegatedToUserId !== currentUserId;
  const delegateInvalid =
    kind === "delegate" && (!delegateUserIdValid || !delegateNotSelf);

  const canSubmit =
    !!kind &&
    !isPending &&
    !lock.isLocked() &&
    (kind === "delegate" ? !delegateInvalid : !noteTooShort);

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !kind) return;
    if (!lock.acquire()) return;

    if (kind === "delegate") {
      delegateMutation.mutate({
        stepId,
        data: {
          delegatedToUserId: parsedDelegatedToUserId,
          decisionNote: trimmedNote === "" ? undefined : trimmedNote,
        },
      });
    } else {
      decideMutation.mutate({
        stepId,
        data: {
          decision: kind,
          decisionNote: trimmedNote === "" ? undefined : trimmedNote,
        },
      });
    }
  };

  // ─── Display strings ──────────────────────────────────────────────────────
  const titleKey = !kind
    ? "approval.decide.title"
    : kind === "approve"
      ? "approval.decide.approveTitle"
      : kind === "reject"
        ? "approval.decide.rejectTitle"
        : kind === "request_resubmission"
          ? "approval.decide.resubmitTitle"
          : "approval.delegate.title";

  const submitLabel = !kind
    ? t("common.continue")
    : kind === "approve"
      ? t("approval.decide.approve")
      : kind === "reject"
        ? t("approval.decide.reject")
        : kind === "request_resubmission"
          ? t("approval.decide.requestResubmission")
          : t("approval.delegate.submit");

  const noteLabelKey =
    kind === "approve"
      ? "approval.decide.noteOptional"
      : kind === "reject"
        ? "approval.decide.rejectReason"
        : kind === "request_resubmission"
          ? "approval.decide.resubmitReason"
          : "approval.delegate.noteOptional";

  const notePlaceholderKey =
    kind === "approve"
      ? "approval.decide.notePlaceholderApprove"
      : kind === "reject"
        ? "approval.decide.notePlaceholderReject"
        : kind === "request_resubmission"
          ? "approval.decide.notePlaceholderResubmit"
          : "approval.delegate.notePlaceholder";

  const warningKey =
    kind === "reject"
      ? "approval.decide.rejectWarning"
      : kind === "request_resubmission"
        ? "approval.decide.resubmitWarning"
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
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
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {t(titleKey)}
          </h2>
          <Button
            ref={firstFocusRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <fieldset className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <legend className="sr-only">{t("approval.decide.legend")}</legend>
          {(
            [
              "approve",
              "reject",
              "request_resubmission",
              "delegate",
            ] as const
          ).map((k) => (
            <label
              key={k}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-md border px-2 py-2 text-[11px] font-medium",
                kind === k
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-ink-muted hover:bg-background",
                isPending && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name="approval-action"
                value={k}
                className="sr-only"
                checked={kind === k}
                onChange={() => setKind(k)}
                disabled={isPending}
              />
              {t(`approval.decide.actionLabel.${k}`)}
            </label>
          ))}
        </fieldset>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
          {kind === "delegate" && (
            <div>
              <label
                htmlFor={userId}
                className="block text-xs font-medium text-ink-muted"
              >
                {t("approval.delegate.targetUser")}
              </label>
              <input
                id={userId}
                type="number"
                inputMode="numeric"
                min={1}
                value={delegatedToUserId}
                onChange={(e) => setDelegatedToUserId(e.target.value)}
                disabled={isPending}
                className={cn(
                  "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                placeholder={t("approval.delegate.targetUserPlaceholder")}
                aria-describedby={`${userId}-help`}
              />
              <p id={`${userId}-help`} className="mt-1 text-[11px] text-ink-subtle">
                {t("approval.delegate.targetUserHelp")}
              </p>
              {kind === "delegate" && delegatedToUserId && !delegateUserIdValid && (
                <p className="mt-1 text-[11px] text-destructive">
                  {t("approval.delegate.invalidUser")}
                </p>
              )}
              {kind === "delegate" && !delegateNotSelf && (
                <p className="mt-1 text-[11px] text-destructive">
                  {t("approval.delegate.cannotSelf")}
                </p>
              )}
            </div>
          )}

          {kind && (
            <div>
              <label
                htmlFor={noteId}
                className="block text-xs font-medium text-ink-muted"
              >
                {t(noteLabelKey)}
                {minLen > 0 && (
                  <span className="ms-1 text-destructive" aria-hidden>
                    *
                  </span>
                )}
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isPending}
                rows={4}
                placeholder={t(notePlaceholderKey)}
                className={cn(
                  "mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              />
              {minLen > 0 && noteTooShort && (
                <p className="mt-1 text-[11px] text-ink-subtle">
                  {t("approval.decide.minChars", { n: minLen })}
                </p>
              )}
            </div>
          )}

          {warningKey && (
            <div className="flex gap-2 rounded-md border border-amber/40 bg-amber-tint/40 p-3 text-[11px] text-amber-ink">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
              <span>{t(warningKey)}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant={
                kind === "reject"
                  ? "destructive"
                  : kind === "request_resubmission"
                    ? "secondary"
                    : "default"
              }
              disabled={!canSubmit}
            >
              {isPending ? t("common.saving") : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ApprovalDecisionDialog;
