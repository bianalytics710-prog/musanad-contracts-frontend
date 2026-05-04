/**
 * ResendInvitationConfirm (S7) — drafter-side modal that resends an
 * invitation for a signature_party.
 *
 * Mode: regenerate — no Lovable equivalent.
 *
 * Behaviour:
 *   - Two states (mirrors SendForSignatureConfirmDialog):
 *     1. PRE-SUBMIT: optional reason textarea + Resend button.
 *     2. POST-SUBMIT: TokenOnceCopyPanel surfaces the new plaintext
 *        invitation token. Plaintext flows into local state only and is
 *        discarded on close.
 *
 * AC mapping:
 *   AC-S7-01..AC-S7-05:
 *     - 200 returns { newInvitationId, invitationTokenPlaintext, expiresAt }.
 *     - reason optional.
 *     - 409 invalid_invitation_status_for_resend / 404 / 403 surfaced via
 *       translateApiError.
 *
 * 13-checklist mapping:
 *   T1/T2 — service via signatureService + React Query mutation.
 *   T3    — every label uses t().
 *   T4    — three states.
 *   T6    — useFocusTrap + Esc-close.
 *   T8    — submit gated by useDoubleSubmitLock.
 *   T13   — invitationTokenPlaintext NEVER persisted; never logged.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { useResendInvitation } from "@/features/signatures/hooks/useSignatures";
import { TokenOnceCopyPanel } from "@/features/signatures/components/TokenOnceCopyPanel";
import { cn } from "@/lib/utils";
import type { ResendInvitationData } from "@/types/entities/signature.types";

interface Props {
  signaturePartyId: number;
  /** Optional contract id for query invalidation scope. */
  contractId?: number;
  /** Optional signer label shown in the post-submit panel. */
  signerLabel?: string;
  /** Optional signer email shown in the post-submit panel. */
  signerEmail?: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MAX_REASON = 2000;

export function ResendInvitationConfirm({
  signaturePartyId,
  contractId,
  signerLabel,
  signerEmail,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const reasonId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [reason, setReason] = useState("");
  const [issued, setIssued] = useState<ResendInvitationData | null>(null);
  const lock = useDoubleSubmitLock();

  const resendMutation = useResendInvitation({
    onSuccess: (resp) => {
      setIssued(resp.data);
      onSuccess?.();
    },
    onSettled: () => lock.release(),
  });

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      setReason("");
      setIssued(null);
    } else {
      setIssued(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !resendMutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, resendMutation.isPending, onClose]);

  if (!open) return null;

  const trimmedReason = reason.trim();
  const tooLong = trimmedReason.length > MAX_REASON;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (resendMutation.isPending || lock.isLocked() || tooLong) return;
    if (!lock.acquire()) return;
    resendMutation.mutate({
      signaturePartyId,
      contractId,
      data:
        trimmedReason === "" ? undefined : { reason: trimmedReason },
    });
  };

  const isSuccess = issued !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !resendMutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-6">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {isSuccess
                ? t("signatures.resend.successTitle")
                : t("signatures.resend.title")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {isSuccess
                ? t("signatures.resend.successDescription")
                : t("signatures.resend.description")}
            </p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={resendMutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!isSuccess && (
            <form onSubmit={handleConfirm} noValidate className="space-y-3">
              <div>
                <label
                  htmlFor={reasonId}
                  className="block text-xs font-medium text-ink-muted"
                >
                  {t("signatures.resend.reasonLabel")}
                </label>
                <textarea
                  id={reasonId}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={resendMutation.isPending}
                  rows={3}
                  maxLength={MAX_REASON}
                  placeholder={t("signatures.resend.reasonPlaceholder")}
                  className={cn(
                    "mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                />
                <p className="mt-1 text-[11px] text-ink-subtle">
                  {trimmedReason.length}/{MAX_REASON}
                </p>
              </div>
            </form>
          )}

          {isSuccess && issued && (
            <TokenOnceCopyPanel
              invitationTokenPlaintext={issued.invitationTokenPlaintext}
              signerEmail={signerEmail ?? null}
              signerLabel={signerLabel}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-background px-6 py-4">
          {!isSuccess && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={resendMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={(e) => handleConfirm(e as unknown as React.FormEvent)}
                disabled={
                  resendMutation.isPending || lock.isLocked() || tooLong
                }
              >
                <RefreshCw className="me-1 h-3.5 w-3.5" />
                {resendMutation.isPending
                  ? t("common.saving")
                  : t("signatures.resend.confirm")}
              </Button>
            </>
          )}
          {isSuccess && (
            <Button type="button" onClick={onClose}>
              {t("common.done")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResendInvitationConfirm;
