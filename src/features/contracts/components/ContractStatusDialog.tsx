/**
 * ContractStatusDialog (S6) — placeholder status update modal.
 *
 * Mode: regenerate-light — full approval/state-machine UX is M2 territory.
 * M1a accepts any of the 14 enum values from any starting state and lets
 * the BE record the transition (AC-S6-07 documents the limitation).
 *
 * AC mapping:
 *   AC-S6-01 — PATCH /api/v1/contracts/:id/status with newStatus + optional reason.
 *   AC-S6-03 — Zod schema enforces enum membership client-side.
 *   AC-S6-04 — disable submit when newStatus === current status.
 *   AC-S6-05..06 — server returns 404/403; toast surfaces ApiError.message.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateContractStatus } from "@/features/contracts/hooks/useContracts";
import { CONTRACT_STATUS_VALUES, type ContractStatus } from "@/types/entities/contract.types";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { cn } from "@/lib/utils";

interface ContractStatusDialogProps {
  contractId: number;
  contractNumber: string;
  currentStatus: ContractStatus;
  open: boolean;
  onClose: () => void;
}

export function ContractStatusDialog({
  contractId,
  contractNumber,
  currentStatus,
  open,
  onClose,
}: ContractStatusDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const statusId = useId();
  const reasonId = useId();
  const firstFocusRef = useRef<HTMLSelectElement>(null);

  const [newStatus, setNewStatus] = useState<ContractStatus>(currentStatus);
  const [reason, setReason] = useState("");

  const mutation = useUpdateContractStatus({
    onSuccess: () => onClose(),
  });

  useEffect(() => {
    if (!open) return;
    setNewStatus(currentStatus);
    setReason("");
    const handle = window.setTimeout(() => firstFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [open, currentStatus]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mutation.isPending, onClose]);

  if (!open) return null;

  const noChange = newStatus === currentStatus;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noChange || mutation.isPending) return;
    mutation.mutate({
      id: contractId,
      data: {
        newStatus,
        reason: reason.trim() === "" ? null : reason.trim(),
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {t("contracts.status.title")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t("contracts.status.description", { number: contractNumber })}
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

        <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <span className="text-ink-muted">{t("contracts.status.current")}</span>
          <ContractStatusBadge status={currentStatus} />
          <ArrowRight className="h-3.5 w-3.5 text-ink-subtle" />
          <ContractStatusBadge status={newStatus} />
        </div>

        <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor={statusId} className="block text-xs font-medium text-ink-muted">
              {t("contracts.status.newStatus")}
            </label>
            <select
              id={statusId}
              ref={firstFocusRef}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ContractStatus)}
              disabled={mutation.isPending}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {CONTRACT_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`contractStatus.${s}`, { defaultValue: s })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={reasonId} className="block text-xs font-medium text-ink-muted">
              {t("contracts.status.reason")}
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={mutation.isPending}
              rows={3}
              className={cn(
                "mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
            <p className="mt-1 text-[11px] text-ink-subtle">{t("contracts.status.reasonHelp")}</p>
          </div>

          <p className="rounded-md border border-amber/40 bg-amber-tint/40 px-3 py-2 text-[11px] text-amber-ink">
            {t("contracts.status.m1aNote")}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={noChange || mutation.isPending}>
              {mutation.isPending ? t("common.saving") : t("contracts.status.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContractStatusDialog;
