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
import type { RouteInitPreviewResponse } from "@/types/entities/approval.types";

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
  const submitMutation = useSubmitForApproval({
    onSuccess: () => {
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
    !lock.isLocked();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!lock.acquire()) return;
    submitMutation.mutate({ contractId });
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
