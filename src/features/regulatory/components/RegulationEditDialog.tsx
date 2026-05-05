/**
 * RegulationEditDialog (S4) — modal patch update for a regulation.
 *
 * Mode: new. AC-S4-05 — referenceCode is immutable; we omit the field
 * entirely from the form so it physically cannot be patched. supersededById
 * is intentionally NOT exposed in this baseline form — admin sets it by
 * editing the new (newer) regulation's "this supersedes …" workflow in a
 * future micro-iteration. (Carry-forward M5-FE-OI-2: in-line "mark as
 * superseded by" picker can be added when the supersession-pairing UX
 * is designed.)
 */
import { useEffect, useId, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import {
  useRegulationById,
  useUpdateRegulation,
} from "@/features/regulatory/hooks/useRegulatory";
import { useRegulatorCatalog } from "@/features/regulatory/hooks/useRegulatorCatalog";
import {
  parseTags,
  regulationEditSchema,
  type RegulationEditFormData,
} from "./regulation-form-schema";
import { RegulationFormFields } from "./RegulationFormFields";
import { translateApiError } from "@/lib/translate-api-error";
import type {
  RegulationJurisdiction,
  RegulationStatus,
  RegulationType,
  UpdateRegulationDto,
} from "@/types/entities/regulatory.types";

interface Props {
  regulationId: number;
  open: boolean;
  onClose: () => void;
}

function toDto(data: RegulationEditFormData): UpdateRegulationDto {
  return {
    titleEn: data.titleEn || undefined,
    titleAr:
      typeof data.titleAr === "string"
        ? data.titleAr.length > 0
          ? data.titleAr
          : null
        : undefined,
    issuerId: data.issuerId !== undefined ? Number(data.issuerId) : undefined,
    regulationType: data.regulationType
      ? (data.regulationType as RegulationType)
      : undefined,
    jurisdiction:
      typeof data.jurisdiction === "string"
        ? data.jurisdiction.length > 0
          ? (data.jurisdiction as RegulationJurisdiction)
          : null
        : undefined,
    effectiveDate: data.effectiveDate ?? undefined,
    summaryEn:
      typeof data.summaryEn === "string"
        ? data.summaryEn.length > 0
          ? data.summaryEn
          : null
        : undefined,
    summaryAr:
      typeof data.summaryAr === "string"
        ? data.summaryAr.length > 0
          ? data.summaryAr
          : null
        : undefined,
    sourceUrl:
      typeof data.sourceUrl === "string"
        ? data.sourceUrl.length > 0
          ? data.sourceUrl
          : null
        : undefined,
    tags: parseTags(typeof data.tags === "string" ? data.tags : undefined),
    status: data.status ? (data.status as RegulationStatus) : undefined,
  };
}

export function RegulationEditDialog({ regulationId, open, onClose }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const { data: existing, isLoading, isError, error } = useRegulationById(
    open ? regulationId : null,
  );
  const { regulators } = useRegulatorCatalog();

  const defaultValues = useMemo<RegulationEditFormData | undefined>(() => {
    if (!existing) return undefined;
    return {
      titleEn: existing.titleEn,
      titleAr: existing.titleAr ?? "",
      issuerId: existing.issuer.id,
      regulationType: existing.regulationType,
      jurisdiction: existing.jurisdiction ?? "",
      effectiveDate: existing.effectiveDate ?? "",
      summaryEn: existing.summaryEn ?? "",
      summaryAr: existing.summaryAr ?? "",
      sourceUrl: existing.sourceUrl ?? "",
      tags: existing.tags.join(", "),
      status: existing.status,
    };
  }, [existing]);

  const form = useForm<RegulationEditFormData>({
    resolver: zodResolver(regulationEditSchema) as never,
    values: defaultValues,
  });

  const mutation = useUpdateRegulation({
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

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate({ id: regulationId, payload: toDto(data) });
  });

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
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {t("regulatory.regulation.edit.title")}
            </h2>
            {existing && (
              <p className="mt-1 font-mono text-xs text-ink-muted">
                {existing.referenceCode}
              </p>
            )}
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

        {isError ? (
          <div className="p-5">
            <div
              role="alert"
              className="rounded-md border border-terracotta/30 bg-terracotta-tint/30 p-4 text-sm text-terracotta-ink"
            >
              {translateApiError(error, t)}
            </div>
          </div>
        ) : isLoading || !existing ? (
          <div role="status" aria-busy="true" className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 w-full animate-pulse rounded-md bg-muted/30"
              />
            ))}
          </div>
        ) : (
          <form
            noValidate
            onSubmit={onSubmit}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-5">
              <RegulationFormFields
                mode="edit"
                register={
                  form.register as unknown as Parameters<
                    typeof RegulationFormFields
                  >[0]["register"]
                }
                errors={
                  form.formState.errors as unknown as Parameters<
                    typeof RegulationFormFields
                  >[0]["errors"]
                }
                disabled={mutation.isPending}
                regulators={regulators}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-4">
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
                  : t("regulatory.regulation.edit.submit")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
