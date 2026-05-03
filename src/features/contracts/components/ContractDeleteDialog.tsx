/**
 * ContractDeleteDialog (S5) — destructive confirmation gate.
 *
 * Mode: regenerate-light — fresh component using v2.6 destructive-action
 * pattern. Type-to-confirm gate per CLAUDE.md §6 T9: the user must type
 * the contract number exactly to enable the Delete button.
 *
 * AC mapping:
 *   AC-S5-01..02 — fires DELETE /contracts/:id, soft-delete cascade.
 *   AC-S5-03..05 — error path surfaced via toast (ApiError.message).
 *   AC-S5-06     — invalidates list + detail; refetch hides soft-deleted row.
 *
 * T9: replaces window.confirm with a focus-trapped modal + type-to-confirm.
 * No React-Aria/Radix Dialog dependency yet in M0 — we render an accessible
 * <div role="dialog" aria-modal> with first-input autofocus and ESC close.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDeleteContract } from "@/features/contracts/hooks/useContracts";

interface ContractDeleteDialogProps {
  contractId: number;
  contractNumber: string;
  contractTitle: string;
  open: boolean;
  onClose: () => void;
  /** When true, the dialog navigates to /app/contracts after a successful delete. */
  redirectOnSuccess?: boolean;
}

export function ContractDeleteDialog({
  contractId,
  contractNumber,
  contractTitle,
  open,
  onClose,
  redirectOnSuccess = false,
}: ContractDeleteDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputId = useId();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // M1b — FE-C4: focus-trap container ref. The trap only attaches when
  // `open` flips true, and detaches on close. See useFocusTrap.ts.
  const dialogRef = useRef<HTMLDivElement>(null);
  const [confirmText, setConfirmText] = useState("");

  // M1b — apply shared focus-trap (FE-C4 deferred from M1a).
  useFocusTrap(dialogRef, open);

  const deleteMutation = useDeleteContract({
    onSuccess: () => {
      onClose();
      if (redirectOnSuccess) {
        void navigate({ to: "/app/contracts" });
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    setConfirmText("");
    // Defer focus to next tick so the dialog has mounted.
    const handle = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteMutation.isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, deleteMutation.isPending]);

  if (!open) return null;

  const canConfirm = confirmText.trim() === contractNumber;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm || deleteMutation.isPending) return;
    deleteMutation.mutate(contractId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleteMutation.isPending) onClose();
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
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-terracotta-tint text-terracotta-ink">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-semibold text-ink">
                {t("contracts.delete.title")}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {t("contracts.delete.description", {
                  number: contractNumber,
                  title: contractTitle,
                })}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={deleteMutation.isPending}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label htmlFor={inputId} className="block text-xs font-medium text-ink-muted">
              {t("contracts.delete.confirmLabel", { number: contractNumber })}
            </label>
            <Input
              id={inputId}
              ref={inputRef}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={deleteMutation.isPending}
              aria-describedby={`${inputId}-help`}
              className="mt-1"
            />
            <p id={`${inputId}-help`} className="mt-1 text-xs text-ink-subtle">
              {t("contracts.delete.confirmHelp")}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={deleteMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!canConfirm || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("common.loading") : t("contracts.delete.confirmButton")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContractDeleteDialog;
