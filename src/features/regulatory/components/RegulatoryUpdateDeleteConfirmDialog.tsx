/**
 * RegulatoryUpdateDeleteConfirmDialog (S10) — T9 destructive confirmation
 * before issuing DELETE /api/v1/regulatory-updates/:id.
 *
 * AC-S10-01: cascade soft-delete; cascadedImpacts count returned.
 * AC-S10-02: structural impacts (regulatory_update_id NULL) untouched.
 * AC-S10-04: platform_admin only.
 */
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDeleteRegulatoryUpdate } from "@/features/regulatory/hooks/useRegulatory";
import type { RegulatoryUpdateListItem } from "@/types/entities/regulatory.types";

interface Props {
  regulatoryUpdate: RegulatoryUpdateListItem;
  open: boolean;
  onClose: () => void;
}

export function RegulatoryUpdateDeleteConfirmDialog({
  regulatoryUpdate,
  open,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const mutation = useDeleteRegulatoryUpdate({
    onSuccess: () => onClose(),
  });

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, mutation.isPending]);

  if (!open) return null;

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
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-terracotta-tint text-terracotta-ink">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-ink">
                {t("regulatory.regulatoryUpdate.delete.title")}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {t("regulatory.regulatoryUpdate.delete.confirmMessage", {
                  title: regulatoryUpdate.titleEn,
                })}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                {t("regulatory.regulatoryUpdate.delete.cascadeWarning")}
              </p>
            </div>
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

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => mutation.mutate(regulatoryUpdate.id)}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? t("common.deleting")
              : t("regulatory.regulatoryUpdate.delete.confirmAction")}
          </Button>
        </div>
      </div>
    </div>
  );
}
