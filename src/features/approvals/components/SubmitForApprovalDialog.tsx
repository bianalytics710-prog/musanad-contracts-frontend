/**
 * SubmitForApprovalDialog (S7) — drafter-facing confirmation modal.
 *
 * Shows the routed chain preview (S6) inline before the drafter clicks
 * Submit. POST /api/v1/contracts/:id/submit-for-approval atomically
 * creates the chain + transitions the contract to in_approval.
 *
 * AC mapping:
 *   AC-S7-01 — POST returns { chainId, contractId, totalSteps, ... }.
 *   AC-S7-03 — preview surfaces 'no rule' state and disables submit.
 *   AC-S7-04 — 409 when an in_progress chain already exists; surfaced
 *              via translateApiError.
 *
 * 13-checklist mapping:
 *   T1/T2 — service through approvalService + React Query.
 *   T3    — every label uses t().
 *   T4    — preview has its own loading/empty/error states inline.
 *   T6    — useFocusTrap + Esc-close.
 *   T8    — submit guarded by useDoubleSubmitLock + mutation.isPending +
 *           hasNoMatchingRule disable.
 *   T11   — wrapped in route ErrorBoundary.
 *   T13   — no decisionNote here (this is the submission, not a decision).
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import {
  usePreviewApprovalChain,
  useSubmitForApproval,
} from "@/features/approvals/hooks/useApprovals";
import { ApprovalChainPreview } from "@/features/approvals/components/ApprovalChainPreview";
import { contractCommentService } from "@/services/api/contract-comment.service";
import type { RouteInitPreviewResponse } from "@/types/entities/approval.types";

// v615 — minimum length for the mandatory submission note. Mirrors the
// BE schema (approval.schemas.ts SubmitForApprovalSchema.submissionNote).
const NOTE_MIN_CHARS = 10;
const NOTE_MAX_CHARS = 2000;

interface Props {
  contractId: number;
  contractType: string;
  valueAed: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SubmitForApprovalDialog({
  contractId,
  contractType,
  valueAed,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [preview, setPreview] = useState<RouteInitPreviewResponse | null>(null);
  const previewMutation = usePreviewApprovalChain({
    onSuccess: (data) => setPreview(data),
  });

  const lock = useDoubleSubmitLock();

  // v615 — mandatory submission note. Drafter must explain what changed
  // before re-submitting. After submit succeeds we also fire it as a
  // contract_comment so mig 613 fan-out pings the first approver and
  // the note becomes the opening message in the Comments thread.
  const [note, setNote] = useState("");
  const noteId = useId();
  const trimmedNoteLen = note.trim().length;
  const noteValid =
    trimmedNoteLen >= NOTE_MIN_CHARS && trimmedNoteLen <= NOTE_MAX_CHARS;

  const submitMutation = useSubmitForApproval({
    onSuccess: () => {
      // Post the note as a contract comment so the now-pending approver
      // sees it in their Comments tab + gets a notification via mig 613.
      // Wrapped in catch — the comment is a nice-to-have, the submit is
      // already done by this point so a comment failure shouldn't block.
      contractCommentService
        .create(contractId, { body: note.trim() })
        .catch(() => {
          /* swallow — submission succeeded; comment is best-effort */
        });
      setNote("");
      onSuccess?.();
      onClose();
    },
    onSettled: () => lock.release(),
  });

  useFocusTrap(dialogRef, open);

  // Re-fetch preview each time the dialog opens.
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setNote("");
      return;
    }
    previewMutation.mutate({
      contractId,
      data: { contractType, valueAed },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contractId, contractType, valueAed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitMutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    const handle = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(handle);
    };
  }, [open, submitMutation.isPending, onClose]);

  if (!open) return null;

  const previewLoading = previewMutation.isPending;
  const previewFailed = previewMutation.isError;
  const hasNoMatchingRule = preview?.hasNoMatchingRule === true;
  const canSubmit =
    !!preview &&
    !hasNoMatchingRule &&
    !submitMutation.isPending &&
    !lock.isLocked() &&
    noteValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!lock.acquire()) return;
    submitMutation.mutate({
      contractId,
      data: { submissionNote: note.trim() },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitMutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {t("approval.submit.title")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t("approval.submit.description")}
            </p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={submitMutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <section className="rounded-md border border-border bg-surface p-3">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t("approval.submit.chainPreviewHeading")}
            </h3>
            {previewLoading && (
              <div
                className="h-20 animate-pulse rounded bg-background"
                aria-label={t("common.loading")}
              />
            )}
            {previewFailed && !previewLoading && (
              <p className="text-xs text-destructive">
                {t("approval.submit.previewFailed")}
              </p>
            )}
            {!previewLoading && !previewFailed && (
              <ApprovalChainPreview mode="preview" data={preview} />
            )}
          </section>

          {/* v615 — mandatory submission note. Disabled state shows the
              min-char requirement; once typing, switches to "X chars" hint. */}
          <div>
            <label
              htmlFor={noteId}
              className="mb-1 block text-xs font-medium text-ink"
            >
              {t("approval.submit.note.label", {
                defaultValue: "Note to approvers",
              })}
              <span className="ms-1 text-destructive">*</span>
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitMutation.isPending}
              rows={4}
              maxLength={NOTE_MAX_CHARS}
              placeholder={t("approval.submit.note.placeholder", {
                defaultValue:
                  "Explain what changed and what you want the approvers to look at…",
              })}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              required
              minLength={NOTE_MIN_CHARS}
              aria-describedby={`${noteId}-hint`}
            />
            <p
              id={`${noteId}-hint`}
              className={`mt-1 text-[11px] ${
                trimmedNoteLen > 0 && !noteValid
                  ? "text-destructive"
                  : "text-ink-muted"
              }`}
            >
              {trimmedNoteLen === 0
                ? t("approval.submit.note.minHint", {
                    defaultValue: "Required — min {{n}} characters",
                    n: NOTE_MIN_CHARS,
                  })
                : trimmedNoteLen < NOTE_MIN_CHARS
                ? t("approval.submit.note.tooShort", {
                    defaultValue: "{{used}} / {{min}} characters",
                    used: trimmedNoteLen,
                    min: NOTE_MIN_CHARS,
                  })
                : t("approval.submit.note.ok", {
                    defaultValue: "{{used}} characters",
                    used: trimmedNoteLen,
                  })}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitMutation.isPending
                ? t("common.saving")
                : t("approval.submit.confirm")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SubmitForApprovalDialog;
