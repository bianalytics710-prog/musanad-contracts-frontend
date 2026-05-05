/**
 * RegulatoryUpdateCreateForm (S8) — modal form for creating a regulatory_update.
 *
 * Mode: new. legal_counsel + platform_admin only via regulations.manage.
 * AC-S8-03 / AC-S8-04 client-side guards on date fields; BE re-validates.
 */
import { useEffect, useId, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import {
  useCreateRegulatoryUpdate,
  useImpactCategoryList,
} from "@/features/regulatory/hooks/useRegulatory";
import { useRegulatorCatalog } from "@/features/regulatory/hooks/useRegulatorCatalog";
import {
  parseClauseCategories,
  regulatoryUpdateCreateSchema,
  type RegulatoryUpdateCreateFormData,
} from "./regulatory-update-form-schema";
import { RegulatoryUpdateFormFields } from "./RegulatoryUpdateFormFields";
import type {
  CreateRegulatoryUpdateDto,
  RegulatorySeverity,
} from "@/types/entities/regulatory.types";

interface Props {
  open: boolean;
  onClose: () => void;
}

function toDto(
  data: RegulatoryUpdateCreateFormData,
): CreateRegulatoryUpdateDto {
  const optStr = (v: unknown): string | null | undefined => {
    if (typeof v !== "string") return undefined;
    return v.length > 0 ? v : null;
  };
  return {
    regulatorId: Number(data.regulatorId),
    titleEn: data.titleEn!,
    titleAr: optStr(data.titleAr),
    summaryEn: optStr(data.summaryEn),
    summaryAr: optStr(data.summaryAr),
    referenceNumber: optStr(data.referenceNumber),
    publishedDate: data.publishedDate!,
    effectiveDate: optStr(data.effectiveDate),
    complianceDeadline: optStr(data.complianceDeadline),
    severity: (data.severity as RegulatorySeverity | undefined) ?? "medium",
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

export function RegulatoryUpdateCreateForm({ open, onClose }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { regulators } = useRegulatorCatalog();
  const { data: categoriesData } = useImpactCategoryList();
  const categories = categoriesData?.data ?? [];

  const form = useForm<RegulatoryUpdateCreateFormData>({
    resolver: zodResolver(regulatoryUpdateCreateSchema) as never,
    defaultValues: {
      regulatorId: undefined,
      titleEn: "",
      titleAr: "",
      summaryEn: "",
      summaryAr: "",
      referenceNumber: "",
      publishedDate: "",
      effectiveDate: "",
      complianceDeadline: "",
      severity: "medium",
      sourceUrl: "",
      affectedClauseCategories: "",
      categoryId: "",
      subSource: "",
    },
  });

  const mutation = useCreateRegulatoryUpdate({
    onSuccess: () => {
      form.reset();
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
    mutation.mutate(toDto(data));
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
            {t("regulatory.regulatoryUpdate.create.title")}
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

        <form
          noValidate
          onSubmit={onSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-5">
            <RegulatoryUpdateFormFields
              register={form.register}
              errors={form.formState.errors}
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
                : t("regulatory.regulatoryUpdate.create.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
