/**
 * FlagObligationDialog — Executive (or other obligation.flag holder) escalates
 * an overdue/due-soon obligation manually.
 *
 * Sends POST /api/v1/obligations/:id/flag with an optional note. BE fans
 * in-app notifications to the type's owner roles + assignee.
 *
 * The dialog shows a preview of who will be notified, derived from the
 * obligation type and the role-mapping locked in mig 500. This is hard-coded
 * to mirror the BE config — if you retune the mapping, update this here too
 * (or fetch from a settings endpoint later).
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  obligationsService,
  type ObligationListItem,
} from "@/services/api/m_parity.service";
import { translateApiError } from "@/lib/translate-api-error";
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";

// Mirrors system_setting.obligations.escalation.role_mapping (mig 500 + 505).
const ROLE_MAPPING: Record<string, string[]> = {
  payment: ["finance_treasury"],
  delivery: ["operations", "procurement_supplier_risk"],
  reporting: ["compliance_esg", "legal_counsel"],
  renewal: ["contract_drafter", "legal_counsel", "finance_treasury"],
  compliance: ["compliance_esg", "legal_counsel"],
  notice: ["legal_counsel", "contract_drafter"],
  other: ["contract_drafter", "legal_counsel"],
};

interface FlagObligationDialogProps {
  open: boolean;
  obligation: ObligationListItem | null;
  onClose: () => void;
}

export function FlagObligationDialog({
  open,
  obligation,
  onClose,
}: FlagObligationDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const roleList = obligation
    ? (ROLE_MAPPING[obligation.obligationType] ?? ["legal_counsel"])
    : [];

  const flagMutation = useMutation({
    mutationFn: async () => {
      if (!obligation) throw new Error("no obligation");
      return obligationsService.flag(obligation.id, {
        note: note.trim() || null,
      });
    },
    onSuccess: (result) => {
      toast.success(
        t("obligations.flag.success", {
          defaultValue: "Flagged. {{count}} notification(s) sent.",
          count: result.notificationCount,
        }),
      );
      void qc.invalidateQueries({ queryKey: ["obligations"] });
      setNote("");
      onClose();
    },
    onError: (e) => {
      toast.error(translateApiError(e, t, "errors.obligation.flagFailed"));
    },
  });

  const handleClose = () => {
    if (flagMutation.isPending) return;
    setNote("");
    onClose();
  };

  if (!obligation) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-terracotta" />
            {t("obligations.flag.title", {
              defaultValue: "Flag obligation for action",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("obligations.flag.description", {
              defaultValue:
                "Notify the owning team so they can action this obligation. They'll see this in their in-app notifications.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("obligations.flag.targetLabel", { defaultValue: "Obligation" })}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{obligation.titleEn}</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
              {obligation.contractNumber} ·{" "}
              {humanizeLabel(obligation.obligationType)}
              {obligation.dueDate
                ? " · due " + obligation.dueDate.slice(0, 10)
                : ""}
            </p>
          </div>

          <div className="rounded-md border border-gold/30 bg-gold/5 p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("obligations.flag.recipientsLabel", {
                defaultValue: "Will notify",
              })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {roleList.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink"
                >
                  {humanizeLabel(r)}
                </span>
              ))}
              {obligation.assigneeUserId && (
                <span className="inline-flex items-center rounded-full bg-sage/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sage">
                  {t("obligations.flag.assignee", {
                    defaultValue: "Assignee",
                  })}
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">
              {t("obligations.flag.recipientsHint", {
                defaultValue:
                  "All active users holding any of these roles will receive an in-app notification.",
              })}
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">
              {t("obligations.flag.noteLabel", {
                defaultValue: "Note (optional)",
              })}
            </span>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("obligations.flag.notePlaceholder", {
                defaultValue:
                  "e.g. CFO asked for an update by end of week — please confirm status.",
              })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-ink"
              maxLength={2000}
            />
            <span className="mt-1 block font-mono text-[10px] text-ink-subtle">
              {note.length} / 2000
            </span>
          </label>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={flagMutation.isPending}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            onClick={() => flagMutation.mutate()}
            disabled={flagMutation.isPending}
          >
            {flagMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Flag className="h-4 w-4" />
            )}
            {t("obligations.flag.submit", { defaultValue: "Flag for action" })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
