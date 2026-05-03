/**
 * ContractEditForm (S4) — partial COALESCE update of an existing contract.
 *
 * Mode: harden — fields are the editable subset of the Lovable detail page's
 * edit slice; the schema enforces the same client-side rules as the BE
 * (status excluded — see DN2; tags excluded — see DN3).
 *
 * AC mapping:
 *   AC-S4-01 — sends only changed fields via PUT /api/v1/contracts/:id.
 *   AC-S4-04 — schema does NOT include `status`; UI provides a separate
 *              dialog (ContractStatusDialog) for status changes.
 *   AC-S4-06 — server validates parent cycle / self-parent.
 *   AC-S4-07 — endDate-after-startDate enforced client-side.
 *   AC-S4-08 — server returns 403; toast surfaces ApiError.message.
 *
 * T8 form hygiene: zodResolver, disabled submit during pending, reset on
 * success, inline errors, noValidate on form.
 */
import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateContract } from "@/features/contracts/hooks/useContracts";
import type {
  Contract,
  ContractLanguage,
  GoverningLaw,
  RelationshipType,
  UpdateContractDto,
} from "@/types/entities/contract.types";
import { ContractFormFields } from "./ContractFormFields";
import { contractEditSchema, type ContractEditFormData } from "./contract-form-schema";

interface ContractEditFormProps {
  contract: Contract;
  /** Called after a successful update; receives the updated contract. */
  onSaved?: (updated: Contract) => void;
  /** Cancel handler — defaults to navigating back to detail. */
  onCancel?: () => void;
}

function toFormDefaults(c: Contract): ContractEditFormData {
  return {
    titleEn: c.titleEn,
    titleAr: c.titleAr,
    contractType: c.contractType,
    language: c.language,
    valueAed: c.valueAed,
    currency: c.currency,
    startDate: c.startDate,
    endDate: c.endDate,
    expiryNoticeDays: c.expiryNoticeDays,
    emirate: c.emirate,
    governingLaw: c.governingLaw ?? "",
    jurisdictionCourt: c.jurisdictionCourt,
    parentContractId: c.parentContractId,
    relationshipType: c.relationshipType ?? "",
    bodyEn: c.bodyEn,
    bodyAr: c.bodyAr,
  } as ContractEditFormData;
}

/**
 * Build an UpdateContractDto containing ONLY the dirty fields. Sending only
 * what changed keeps audit_log noise down and lets the server apply
 * COALESCE cleanly.
 */
function dirtyToDto(
  data: ContractEditFormData,
  dirty: Partial<Record<keyof ContractEditFormData, boolean>>,
): UpdateContractDto {
  const dto: UpdateContractDto = {};
  const trimOrNull = (v: string | null | undefined) =>
    typeof v === "string" && v.trim() === "" ? null : (v ?? null);

  if (dirty.titleEn) dto.titleEn = data.titleEn ?? "";
  if (dirty.titleAr) dto.titleAr = trimOrNull(data.titleAr);
  if (dirty.contractType) dto.contractType = data.contractType ?? "";
  if (dirty.language) dto.language = data.language as ContractLanguage;
  if (dirty.valueAed) dto.valueAed = data.valueAed ?? null;
  if (dirty.currency) dto.currency = trimOrNull(data.currency) ?? undefined;
  if (dirty.startDate) dto.startDate = trimOrNull(data.startDate);
  if (dirty.endDate) dto.endDate = trimOrNull(data.endDate);
  if (dirty.expiryNoticeDays) dto.expiryNoticeDays = data.expiryNoticeDays;
  if (dirty.emirate) dto.emirate = trimOrNull(data.emirate);
  if (dirty.governingLaw) dto.governingLaw = (data.governingLaw as GoverningLaw | null) ?? null;
  if (dirty.jurisdictionCourt) dto.jurisdictionCourt = trimOrNull(data.jurisdictionCourt);
  if (dirty.parentContractId)
    dto.parentContractId = typeof data.parentContractId === "number" ? data.parentContractId : null;
  if (dirty.relationshipType)
    dto.relationshipType = (data.relationshipType as RelationshipType | null) ?? null;
  if (dirty.bodyEn) dto.bodyEn = trimOrNull(data.bodyEn);
  if (dirty.bodyAr) dto.bodyAr = trimOrNull(data.bodyAr);
  return dto;
}

export function ContractEditForm({ contract, onSaved, onCancel }: ContractEditFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const defaults = useMemo(() => toFormDefaults(contract), [contract]);

  const form = useForm<ContractEditFormData>({
    resolver: zodResolver(contractEditSchema) as never,
    defaultValues: defaults,
  });

  // Reset the form whenever the contract prop refreshes (e.g. after refetch).
  useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  // FE-C1 (Codex): scrub sensitive body fields from RHF state on unmount.
  // The edit form was hydrated with the contract's bodyEn/bodyAr; we must
  // clear them on teardown so navigating away from the detail view does
  // not leave the body text resident in component memory.
  useEffect(() => {
    return () => {
      form.reset({ bodyEn: null, bodyAr: null });
    };
    // Single unmount-cleanup; form is a stable RHF instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutation = useUpdateContract({
    onSuccess: (updated) => {
      form.reset(toFormDefaults(updated));
      onSaved?.(updated);
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    const dirty = form.formState.dirtyFields as Partial<
      Record<keyof ContractEditFormData, boolean>
    >;
    const dto = dirtyToDto(data, dirty);
    if (Object.keys(dto).length === 0) {
      // Nothing to send — return to caller without firing a request.
      onSaved?.(contract);
      return;
    }
    mutation.mutate({ id: contract.id, data: dto });
  });

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    void navigate({
      to: "/app/contracts/$id",
      params: { id: String(contract.id) },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("contracts.edit.formTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={onSubmit} className="space-y-6">
          <ContractFormFields
            register={form.register as never}
            errors={form.formState.errors as never}
            disabled={mutation.isPending}
          />

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={mutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
              {mutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default ContractEditForm;
