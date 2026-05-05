/**
 * RegulationCreateDialog (S3) — modal create form for regulations.
 *
 * Mode: new (no Lovable equivalent). regulations.manage permission gate
 * server-side; FE simply hides the trigger when the caller lacks it.
 *
 * AC mapping:
 *   AC-S3-01..03 — POST with referenceCode + titleEn + issuerId + regulationType.
 *   AC-S3-04 — invalid enum surfaces as field-level error.
 *   AC-S3-05 — 403 when caller lacks regulations.manage (BE).
 *   AC-S3-06 — status defaults to 'active' when omitted.
 *
 * 13-checklist: T6 focus trap + ESC + role=dialog; T8 zodResolver +
 * disable-on-pending; T13 no console.log of payload.
 */
import { useEffect, useId, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useCreateRegulation } from "@/features/regulatory/hooks/useRegulatory";
import { useRegulatorCatalog } from "@/features/regulatory/hooks/useRegulatorCatalog";
import {
  parseTags,
  regulationCreateSchema,
  type RegulationCreateFormData,
} from "./regulation-form-schema";
import { RegulationFormFields } from "./RegulationFormFields";
import type {
  CreateRegulationDto,
  RegulationJurisdiction,
  RegulationStatus,
  RegulationType,
} from "@/types/entities/regulatory.types";

interface Props {
  open: boolean;
  onClose: () => void;
}

function toDto(data: RegulationCreateFormData): CreateRegulationDto {
  return {
    referenceCode: data.referenceCode!,
    titleEn: data.titleEn!,
    titleAr: typeof data.titleAr === "string" && data.titleAr.length > 0
      ? data.titleAr
      : null,
    issuerId: Number(data.issuerId),
    regulationType: data.regulationType as RegulationType,
    jurisdiction:
      typeof data.jurisdiction === "string" && data.jurisdiction.length > 0
        ? (data.jurisdiction as RegulationJurisdiction)
        : null,
    effectiveDate: data.effectiveDate ?? null,
    summaryEn: typeof data.summaryEn === "string" && data.summaryEn.length > 0
      ? data.summaryEn
      : null,
    summaryAr: typeof data.summaryAr === "string" && data.summaryAr.length > 0
      ? data.summaryAr
      : null,
    sourceUrl: typeof data.sourceUrl === "string" && data.sourceUrl.length > 0
      ? data.sourceUrl
      : null,
    tags: parseTags(typeof data.tags === "string" ? data.tags : undefined),
    status: (data.status as RegulationStatus | undefined) ?? "active",
  };
}

export function RegulationCreateDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { regulators } = useRegulatorCatalog();

  const form = useForm<RegulationCreateFormData>({
    resolver: zodResolver(regulationCreateSchema) as never,
    defaultValues: {
      referenceCode: "",
      titleEn: "",
      titleAr: "",
      issuerId: undefined,
      regulationType: "",
      jurisdiction: "",
      effectiveDate: "",
      summaryEn: "",
      summaryAr: "",
      sourceUrl: "",
      tags: "",
      status: "active",
    },
  });

  const mutation = useCreateRegulation({
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
            {t("regulatory.regulation.create.title")}
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
            <RegulationFormFields
              mode="create"
              register={form.register}
              errors={form.formState.errors}
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
                : t("regulatory.regulation.create.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
