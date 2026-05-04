/**
 * ContractStatusDialog (S6 + M2 S12) — narrowed-transition status update modal.
 *
 * M2 / AE-2 update: the BE now enforces a narrow per-transition matrix via
 * fn_contract_status_update_user. The FE mirrors the matrix in
 * UPDATE_CONTRACT_STATUS_USER_TARGETS so the dropdown only surfaces valid
 * targets — keeping the UI in sync with what the server will accept.
 * Transitions out of `in_approval` (approve / reject / resubmit) MUST go
 * through fn_approval_decide via the Approvals page; this dialog hides
 * those targets entirely.
 *
 * AC mapping:
 *   AC-S6-01     — PATCH /api/v1/contracts/:id/status with newStatus + reason.
 *   AC-S12-01..03 — narrowed transition list shown to the user.
 *   AC-S12-09    — previously-permissive M1a transitions (e.g. draft →
 *                   approved) are no longer offered.
 *   AC-S6-04     — submit disabled when no valid target selected.
 *   AC-S6-05..06 — server 404/403; translateApiError surfaces a localized
 *                   message via the mutation's onError path.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useUpdateContractStatus } from "@/features/contracts/hooks/useContracts";
import {
  UPDATE_CONTRACT_STATUS_USER_TARGETS,
  type ContractStatus,
} from "@/types/entities/contract.types";
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
  // M1b — FE-C4 focus-trap container ref.
  const dialogRef = useRef<HTMLDivElement>(null);

  // M2 — narrow targets per the AE-2 transition matrix; show empty when
  // the contract is in a state that has no user-driven targets (e.g.
  // in_approval — only fn_approval_decide can leave that state).
  const narrowedTargets = useMemo<readonly ContractStatus[]>(
    () => UPDATE_CONTRACT_STATUS_USER_TARGETS[currentStatus] ?? [],
    [currentStatus],
  );

  const [newStatus, setNewStatus] = useState<ContractStatus>(
    narrowedTargets[0] ?? currentStatus,
  );
  const [reason, setReason] = useState("");

  // M1b — apply shared focus-trap (FE-C4 deferred from M1a).
  useFocusTrap(dialogRef, open);

  const mutation = useUpdateContractStatus({
    onSuccess: () => onClose(),
  });

  useEffect(() => {
    if (!open) return;
    setNewStatus(narrowedTargets[0] ?? currentStatus);
    setReason("");
    const handle = window.setTimeout(() => firstFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [open, currentStatus, narrowedTargets]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mutation.isPending, onClose]);

  if (!open) return null;

  const noTargets = narrowedTargets.length === 0;
  const noChange = newStatus === currentStatus;
  const targetInvalid = !narrowedTargets.includes(newStatus);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noChange || targetInvalid || mutation.isPending) return;
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
              disabled={mutation.isPending || noTargets}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {narrowedTargets.map((s) => (
                <option key={s} value={s}>
                  {t(`contractStatus.${s}`, { defaultValue: s })}
                </option>
              ))}
            </select>
            {noTargets && (
              <p className="mt-1 text-[11px] text-ink-subtle">
                {t("contracts.status.noUserTargets", {
                  defaultValue:
                    "This status can only be changed via the approval workflow.",
                })}
              </p>
            )}
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={noChange || targetInvalid || noTargets || mutation.isPending}
            >
              {mutation.isPending ? t("common.saving") : t("contracts.status.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContractStatusDialog;
