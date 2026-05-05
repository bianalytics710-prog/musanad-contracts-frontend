/**
 * RegulationDeleteConfirmDialog (S5) — T9 destructive confirmation modal
 * before issuing DELETE /api/v1/regulations/:id.
 *
 * Mode: new. Mirrors the existing imports/ConfirmDialog ergonomics:
 * - role=dialog, aria-modal, focus trap (T6)
 * - ESC closes (when not pending)
 * - explicit user confirmation required (T9)
 *
 * AC mapping:
 *   AC-S5-01 — soft-delete on confirm.
 *   AC-S5-02 — 409 when active impacts exist; surfaced via toast in hook.
 *   AC-S5-03 — 404 if already deleted; surfaced via toast in hook.
 *   AC-S5-04 — 403 if caller is not platform_admin; surfaced via toast.
 */
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useDeleteRegulation } from "@/features/regulatory/hooks/useRegulatory";
import type { RegulationListItem } from "@/types/entities/regulatory.types";

interface Props {
  regulation: RegulationListItem;
  open: boolean;
  onClose: () => void;
}

export function RegulationDeleteConfirmDialog({
  regulation,
  open,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const mutation = useDeleteRegulation({
    onSuccess: () => {
      onClose();
    },
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
                {t("regulatory.regulation.delete.title")}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {t("regulatory.regulation.delete.confirmMessage", {
                  code: regulation.referenceCode,
                  title: regulation.titleEn,
                })}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                {t("regulatory.regulation.delete.activeImpactsWarning")}
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
            onClick={() => mutation.mutate(regulation.id)}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? t("common.deleting")
              : t("regulatory.regulation.delete.confirmAction")}
          </Button>
        </div>
      </div>
    </div>
  );
}
