/**
 * SendForSignatureConfirmDialog (S2) — confirm modal that triggers
 * POST /api/v1/contracts/:id/send-for-signature.
 *
 * Mode: regenerate — no Lovable equivalent.
 *
 * Behaviour:
 *   - Two states:
 *     1. PRE-SUBMIT: confirmation copy + Send button. Cancel allowed.
 *     2. POST-SUBMIT: success state with TokenOnceCopyPanel for each
 *        invitation in the response. The plaintext invitation token is
 *        held in component state ONLY for the open lifetime of this
 *        dialog; closing discards it.
 *
 * AC mapping:
 *   AC-S2-01 — POST returns { contractId, newStatus, invitations[] }.
 *   AC-S2-02 — invitations[].invitationTokenPlaintext returned ONCE; surfaced
 *              via TokenOnceCopyPanel for drafter to copy + send via their
 *              own channel.
 *   AC-S2-04..S2-09 — error path delegated to translateApiError.
 *
 * 13-checklist mapping:
 *   T1/T2 — service via signatureService + React Query mutation.
 *   T3    — every label uses t().
 *   T4    — three states: confirm / pending / success-with-tokens.
 *   T6    — useFocusTrap + Esc-close.
 *   T8    — submit gated by useDoubleSubmitLock + mutation.isPending.
 *   T11   — caller wraps in route ErrorBoundary.
 *   T13   — invitationTokenPlaintext NEVER persisted; never logged.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDoubleSubmitLock } from "@/features/imports/hooks/useDoubleSubmitLock";
import { useSendForSignature } from "@/features/signatures/hooks/useSignatures";
import { TokenOnceCopyPanel } from "@/features/signatures/components/TokenOnceCopyPanel";
import type { SendForSignatureData } from "@/types/entities/signature.types";

interface Props {
  contractId: number;
  contractNumber?: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SendForSignatureConfirmDialog({
  contractId,
  contractNumber,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /** When non-null, render the post-submit success panel with the tokens. */
  const [issued, setIssued] = useState<SendForSignatureData | null>(null);
  const lock = useDoubleSubmitLock();

  const sendMutation = useSendForSignature({
    onSuccess: (resp) => {
      // Tokens flow into local state ONLY. Never persisted.
      setIssued(resp.data);
      onSuccess?.();
    },
    onSettled: () => lock.release(),
  });

  useFocusTrap(dialogRef, open);

  // Reset transient state on each open.
  useEffect(() => {
    if (open) {
      setIssued(null);
    } else {
      // Discard tokens on close.
      setIssued(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sendMutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sendMutation.isPending, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    if (sendMutation.isPending || lock.isLocked()) return;
    if (!lock.acquire()) return;
    sendMutation.mutate({ contractId });
  };

  const isSuccess = issued !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sendMutation.isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-6">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {isSuccess
                ? t("signatures.send.successTitle")
                : t("signatures.send.title")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {isSuccess
                ? t("signatures.send.successDescription")
                : t("signatures.send.description")}
            </p>
            {contractNumber && (
              <p className="mt-1 font-mono text-xs text-ink-subtle">
                {contractNumber}
              </p>
            )}
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={sendMutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!isSuccess && (
            <p className="text-sm text-ink-muted">
              {t("signatures.send.body")}
            </p>
          )}

          {isSuccess && issued && (
            <div className="space-y-3">
              {issued.invitations.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  {t("signatures.send.noInvitations")}
                </p>
              ) : (
                <>
                  <p className="text-sm text-ink">
                    {t("signatures.send.issuedCount", {
                      n: issued.invitations.length,
                    })}
                  </p>
                  <ul className="space-y-3">
                    {issued.invitations.map((inv) => (
                      <li key={inv.signaturePartyId}>
                        <TokenOnceCopyPanel
                          invitationTokenPlaintext={inv.invitationTokenPlaintext}
                          signerEmail={inv.signerEmail}
                          signerLabel={t("signatures.send.signerN", {
                            n: inv.signaturePartyId,
                          })}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-background px-6 py-4">
          {!isSuccess && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={sendMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={sendMutation.isPending || lock.isLocked()}
              >
                <Send className="me-1 h-3.5 w-3.5" />
                {sendMutation.isPending
                  ? t("common.saving")
                  : t("signatures.send.confirm")}
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

export default SendForSignatureConfirmDialog;
