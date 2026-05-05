/**
 * RegulatoryImpactResolveDialog (S13) — resolve an impact with a
 * resolutionAction + optional note.
 *
 * Mode: new. Per AC-S13-05, polymorphic permission: regulations.manage OR
 * the contract's drafted_by — the BE enforces; the FE only gates visibility
 * of the trigger via regulations.read (and shows toast on 403 otherwise).
 *
 * AC mapping:
 *   AC-S13-01 — resolutionAction ∈ {amended,waived,out_of_scope,pending}.
 *   AC-S13-02 — resolved derived: action <> 'pending'.
 *   AC-S13-03 — invalid action → 400.
 *   AC-S13-07 — resolutionNote stored verbatim (admin-bounded; not redacted
 *               at BE per Q8).
 *
 * T9 destructive confirmation — resolve action is itself the explicit
 * commitment; users must pick an action + (optionally) note + click submit.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useResolveRegulatoryImpact } from "@/features/regulatory/hooks/useRegulatory";
import {
  REGULATORY_IMPACT_RESOLUTION_ACTION_VALUES,
  type RegulatoryImpact,
  type RegulatoryImpactResolutionAction,
} from "@/types/entities/regulatory.types";

interface Props {
  impact: RegulatoryImpact;
  open: boolean;
  onClose: () => void;
}

export function RegulatoryImpactResolveDialog({
  impact,
  open,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [action, setAction] = useState<RegulatoryImpactResolutionAction>(
    impact.resolutionAction ?? "amended",
  );
  const [note, setNote] = useState<string>(impact.resolutionNote ?? "");

  const mutation = useResolveRegulatoryImpact({
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      id: impact.id,
      payload: {
        resolutionAction: action,
        resolutionNote: note.trim() === "" ? null : note,
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
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {t("regulatory.impact.resolve.title")}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {impact.contract.contractNumber} · {impact.regulation.referenceCode}
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

        <form noValidate onSubmit={onSubmit} className="mt-4 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">
              {t("regulatory.impact.resolve.actionLabel")}
            </legend>
            {REGULATORY_IMPACT_RESOLUTION_ACTION_VALUES.map((v) => (
              <label
                key={v}
                className="flex items-start gap-2 rounded-md border border-border bg-card p-2 text-sm hover:border-gold/40"
              >
                <input
                  type="radio"
                  name="resolutionAction"
                  value={v}
                  checked={action === v}
                  onChange={() => setAction(v)}
                  disabled={mutation.isPending}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium text-ink">
                    {t(`regulatory.impact.resolutionAction.${v}`)}
                  </span>
                  <p className="text-xs text-ink-muted">
                    {t(`regulatory.impact.resolutionActionHelp.${v}`)}
                  </p>
                </div>
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">
              {t("regulatory.impact.resolve.noteLabel")}
            </span>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={mutation.isPending}
              placeholder={t("regulatory.impact.resolve.notePlaceholder")}
              maxLength={500}
            />
            <span className="text-xs text-ink-muted">
              {t("regulatory.impact.resolve.noteHelp")}
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t("common.saving")
                : t("regulatory.impact.resolve.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
