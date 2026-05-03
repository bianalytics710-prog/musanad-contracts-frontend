/**
 * ContractCreateForm (S3) — basic create form (NOT the M1b Compose Wizard).
 *
 * Mode: regenerate-light — derived from compose-wizard fields without the
 * 5-step wizard chrome (M1b territory). Uses the shared ContractFormFields
 * for the field set, plus react-hook-form + Zod for validation.
 *
 * AC mapping:
 *   AC-S3-01 — POST /api/v1/contracts with at minimum titleEn + contractType.
 *   AC-S3-04..09 — Zod schema produces field-level error messages whose i18n
 *                  keys match BE error messages where applicable.
 *   AC-S3-10 — server returns 403; toast surfaces ApiError.message.
 *
 * T8 form hygiene fully applied: zodResolver, disabled submit during pending,
 * reset() on success (handled implicitly by navigation away), inline errors,
 * noValidate on form.
 */
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateContract } from "@/features/contracts/hooks/useContracts";
import type {
  CreateContractDto,
  ContractLanguage,
  GoverningLaw,
  RelationshipType,
} from "@/types/entities/contract.types";
import { ContractFormFields } from "./ContractFormFields";
import { contractCreateSchema, type ContractCreateFormData } from "./contract-form-schema";

/**
 * Convert FormData (string-y values from the DOM) to the strictly-typed
 * CreateContractDto. Empty strings + nulls become undefined so they aren't
 * sent at all; the server applies defaults.
 */
function toDto(data: ContractCreateFormData): CreateContractDto {
  /** Empty/whitespace strings become undefined; non-empty pass through. */
  const orUndef = (v: string | null | undefined): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v : undefined;
  /** Empty/whitespace strings become null (signals "explicit unset"). */
  const orNull = (v: string | null | undefined): string | null | undefined =>
    typeof v === "string" && v.trim() === "" ? null : (v ?? undefined);

  return {
    titleEn: data.titleEn,
    titleAr: orNull(data.titleAr),
    contractType: data.contractType,
    language: (data.language as ContractLanguage | undefined) ?? undefined,
    valueAed: data.valueAed === null ? undefined : data.valueAed,
    currency: orUndef(data.currency),
    startDate: orNull(data.startDate),
    endDate: orNull(data.endDate),
    expiryNoticeDays: data.expiryNoticeDays,
    emirate: orNull(data.emirate),
    governingLaw: (data.governingLaw as GoverningLaw | null) ?? undefined,
    jurisdictionCourt: orNull(data.jurisdictionCourt),
    parentContractId: typeof data.parentContractId === "number" ? data.parentContractId : undefined,
    relationshipType: (data.relationshipType as RelationshipType | null) ?? undefined,
    bodyEn: orNull(data.bodyEn),
    bodyAr: orNull(data.bodyAr),
  };
}

export function ContractCreateForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const form = useForm<ContractCreateFormData>({
    // The schema's transforms widen the inferred output type; we cast
    // through `unknown` because Zod's transform output is structurally
    // a superset of the form input shape.
    resolver: zodResolver(contractCreateSchema) as never,
    defaultValues: {
      titleEn: "",
      titleAr: null,
      contractType: "",
      language: "en",
      valueAed: null,
      currency: "AED",
      startDate: null,
      endDate: null,
      expiryNoticeDays: 30,
      emirate: null,
      governingLaw: "",
      jurisdictionCourt: null,
      parentContractId: null,
      relationshipType: "",
      bodyEn: null,
      bodyAr: null,
    },
  });

  const mutation = useCreateContract({
    onSuccess: (created) => {
      form.reset();
      void navigate({
        to: "/app/contracts/$id",
        params: { id: String(created.id) },
      });
    },
  });

  // FE-C1 (Codex): scrub sensitive body fields from RHF state on unmount.
  // Without this, an unmounted-but-not-GC'd form retains bodyEn/bodyAr in
  // memory until the next mount or successful submit. Reset to empty on
  // teardown so navigation away leaves no residue.
  useEffect(() => {
    return () => {
      form.reset({ bodyEn: null, bodyAr: null });
    };
    // form is a stable RHF instance; we deliberately want a single
    // unmount-cleanup, hence the empty dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(toDto(data));
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("contracts.create.title")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{t("contracts.create.subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("contracts.create.formTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={onSubmit} className="space-y-6">
            <ContractFormFields
              register={form.register as never}
              errors={form.formState.errors as never}
              disabled={mutation.isPending}
              requireCore
            />

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void navigate({ to: "/app/contracts" })}
                disabled={mutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t("common.saving") : t("contracts.create.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ContractCreateForm;
