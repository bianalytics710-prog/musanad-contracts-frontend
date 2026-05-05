/**
 * RegulatoryUpdateEditForm (S9) — modal patch update for regulatory_update.
 *
 * AC-S9-02 publishedDate floor guard is BE-side; FE shows 400 toast.
 */
import { useEffect, useId, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import {
  useImpactCategoryList,
  useRegulatoryUpdateById,
  useUpdateRegulatoryUpdate,
} from "@/features/regulatory/hooks/useRegulatory";
import { useRegulatorCatalog } from "@/features/regulatory/hooks/useRegulatorCatalog";
import {
  parseClauseCategories,
  regulatoryUpdateEditSchema,
  type RegulatoryUpdateEditFormData,
} from "./regulatory-update-form-schema";
import { RegulatoryUpdateFormFields } from "./RegulatoryUpdateFormFields";
import { translateApiError } from "@/lib/translate-api-error";
import type {
  RegulatorySeverity,
  UpdateRegulatoryUpdateDto,
} from "@/types/entities/regulatory.types";

interface Props {
  regulatoryUpdateId: number;
  open: boolean;
  onClose: () => void;
}

function toDto(
  data: RegulatoryUpdateEditFormData,
): UpdateRegulatoryUpdateDto {
  const optStr = (v: unknown): string | null | undefined => {
    if (typeof v !== "string") return undefined;
    return v.length > 0 ? v : null;
  };
  return {
    regulatorId:
      data.regulatorId !== undefined ? Number(data.regulatorId) : undefined,
    titleEn: data.titleEn || undefined,
    titleAr: optStr(data.titleAr),
    summaryEn: optStr(data.summaryEn),
    summaryAr: optStr(data.summaryAr),
    referenceNumber: optStr(data.referenceNumber),
    publishedDate: data.publishedDate || undefined,
    effectiveDate: optStr(data.effectiveDate),
    complianceDeadline: optStr(data.complianceDeadline),
    severity: data.severity
      ? (data.severity as RegulatorySeverity)
      : undefined,
    sourceUrl: optStr(data.sourceUrl),
    affectedClauseCategories: parseClauseCategories(
      typeof data.affectedClauseCategories === "string"
        ? data.affectedClauseCategories
        : undefined,
    ),
    categoryId:
      typeof data.categoryId === "number" && data.categoryId > 0
        ? data.categoryId
        : null,
    subSource: optStr(data.subSource),
  };
}

export function RegulatoryUpdateEditForm({
  regulatoryUpdateId,
  open,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { regulators } = useRegulatorCatalog();
  const { data: categoriesData } = useImpactCategoryList();
  const categories = categoriesData?.data ?? [];

  const { data: existing, isLoading, isError, error } = useRegulatoryUpdateById(
    open ? regulatoryUpdateId : null,
  );

  const defaultValues = useMemo<RegulatoryUpdateEditFormData | undefined>(() => {
    if (!existing) return undefined;
    return {
      regulatorId: existing.regulator.id,
      titleEn: existing.titleEn,
      titleAr: existing.titleAr ?? "",
      summaryEn: existing.summaryEn ?? "",
      summaryAr: existing.summaryAr ?? "",
      referenceNumber: existing.referenceNumber ?? "",
      publishedDate: existing.publishedDate,
      effectiveDate: existing.effectiveDate ?? "",
      complianceDeadline: existing.complianceDeadline ?? "",
      severity: existing.severity,
      sourceUrl: existing.sourceUrl ?? "",
      affectedClauseCategories: existing.affectedClauseCategories.join(", "),
      categoryId: existing.category?.id ?? "",
      subSource: existing.subSource ?? "",
    };
  }, [existing]);

  const form = useForm<RegulatoryUpdateEditFormData>({
    resolver: zodResolver(regulatoryUpdateEditSchema) as never,
    values: defaultValues,
  });

  const mutation = useUpdateRegulatoryUpdate({
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

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate({
      id: regulatoryUpdateId,
      payload: toDto(data),
    });
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
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {t("regulatory.regulatoryUpdate.edit.title")}
          </h2>
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
              <RegulatoryUpdateFormFields
                register={
                  form.register as unknown as Parameters<
                    typeof RegulatoryUpdateFormFields
                  >[0]["register"]
                }
                errors={
                  form.formState.errors as unknown as Parameters<
                    typeof RegulatoryUpdateFormFields
                  >[0]["errors"]
                }
                disabled={mutation.isPending}
                regulators={regulators}
                categories={categories}
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
                  : t("regulatory.regulatoryUpdate.edit.submit")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
