/**
 * Step2Parties — Compose Wizard Step 2 (Key Terms + payment-schedule sub-table).
 *
 * AC-S1-03:
 *   - titleEn (required), titleAr (optional)
 *   - valueAed (optional, >=0), currency (default 'AED')
 *   - startDate, endDate, expiryNoticeDays (default 30)
 *   - emirate, governingLaw, jurisdictionCourt
 *   - parentContractId (optional)
 *   - payment-schedule sub-table — Add Row / Remove Row
 *
 * NB: HijriDatePicker preservation (Lovable AC-S6-03) — M1b ships standard
 * <input type="date"> for both Gregorian + Hijri parity per Q1 deferred
 * picker decision; the dedicated picker lands with the I18n / Calendar
 * module in a later release.
 *
 * AC-S3-09: max 100 milestone rows. The Add Row button disables when the
 * array is at 100. AC-S3-05 / AC-S3-06: row-level validation lives in
 * paymentScheduleRowSchema (compose-wizard-schemas.ts).
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  GOVERNING_LAW_VALUES,
  RELATIONSHIP_TYPE_VALUES,
  type GoverningLaw,
  type RelationshipType,
} from "@/types/entities/contract.types";
import {
  PAYMENT_SCHEDULE_RECURRENCE_VALUES,
  PAYMENT_SCHEDULE_STATUS_VALUES,
  type PaymentScheduleStatus,
  type PaymentScheduleRecurrence,
} from "@/types/entities/payment-schedule.types";
import { composeStep2Schema, type ComposeStep2FormData } from "../compose-wizard-schemas";
import type {
  ComposeWizardStep2Parties,
  PaymentScheduleCreateDto,
} from "@/types/entities/payment-schedule.types";

/** Max payment-schedule rows per AC-S3-09. */
const MAX_PAYMENT_ROWS = 100;

/** Default seed for a new milestone row (Add Row button). */
function emptyRow(): PaymentScheduleCreateDto {
  return {
    milestoneLabelEn: "",
    milestoneLabelAr: null,
    milestoneNameEn: null,
    milestoneNameAr: null,
    amountAed: 0,
    dueDate: null,
    paidAt: null,
    status: "pending" as PaymentScheduleStatus,
    recurrence: null,
    invoiceRef: null,
  };
}

interface Step2PartiesProps {
  value: ComposeWizardStep2Parties;
  onChange: (next: ComposeWizardStep2Parties) => void;
  disabled?: boolean;
}

export function Step2Parties({ value, onChange, disabled = false }: Step2PartiesProps) {
  const { t } = useTranslation();

  const form = useForm<ComposeStep2FormData>({
    resolver: zodResolver(composeStep2Schema) as never,
    mode: "onBlur",
    defaultValues: {
      titleEn: value.titleEn ?? "",
      titleAr: value.titleAr ?? null,
      valueAed: value.valueAed ?? null,
      currency: value.currency ?? "AED",
      startDate: value.startDate ?? null,
      endDate: value.endDate ?? null,
      expiryNoticeDays: value.expiryNoticeDays ?? 30,
      emirate: value.emirate ?? null,
      governingLaw: (value.governingLaw ?? null) as ComposeStep2FormData["governingLaw"],
      jurisdictionCourt: value.jurisdictionCourt ?? null,
      parentContractId: value.parentContractId ?? null,
      relationshipType: (value.relationshipType ??
        null) as ComposeStep2FormData["relationshipType"],
      paymentSchedule: value.paymentSchedule ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "paymentSchedule",
  });

  const watched = form.watch();
  // Stable dep — JSON of the schedule array, computed once per render. The
  // useEffect dep array can't contain expressions (lint warns), so extract.
  const watchedScheduleJson = JSON.stringify(watched.paymentSchedule);
  useEffect(() => {
    onChange({
      titleEn: watched.titleEn,
      titleAr:
        typeof watched.titleAr === "string" && watched.titleAr.trim() === ""
          ? null
          : (watched.titleAr ?? null),
      valueAed: typeof watched.valueAed === "number" ? watched.valueAed : null,
      currency:
        typeof watched.currency === "string" && watched.currency.trim() !== ""
          ? watched.currency
          : "AED",
      startDate:
        typeof watched.startDate === "string" && watched.startDate.trim() === ""
          ? null
          : (watched.startDate ?? null),
      endDate:
        typeof watched.endDate === "string" && watched.endDate.trim() === ""
          ? null
          : (watched.endDate ?? null),
      expiryNoticeDays:
        typeof watched.expiryNoticeDays === "number" ? watched.expiryNoticeDays : 30,
      emirate:
        typeof watched.emirate === "string" && watched.emirate.trim() === ""
          ? null
          : (watched.emirate ?? null),
      governingLaw: (watched.governingLaw as GoverningLaw | null) ?? null,
      jurisdictionCourt:
        typeof watched.jurisdictionCourt === "string" && watched.jurisdictionCourt.trim() === ""
          ? null
          : (watched.jurisdictionCourt ?? null),
      parentContractId:
        typeof watched.parentContractId === "number" ? watched.parentContractId : null,
      relationshipType: (watched.relationshipType as RelationshipType | null) ?? null,
      paymentSchedule: (watched.paymentSchedule ?? []) as PaymentScheduleCreateDto[],
    });
    // Re-emit whenever any tracked field changes. Using JSON-stringified
    // paymentSchedule guards against array-identity churn from RHF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watched.titleEn,
    watched.titleAr,
    watched.valueAed,
    watched.currency,
    watched.startDate,
    watched.endDate,
    watched.expiryNoticeDays,
    watched.emirate,
    watched.governingLaw,
    watched.jurisdictionCourt,
    watched.parentContractId,
    watched.relationshipType,
    watchedScheduleJson,
  ]);

  const addDisabled = disabled || fields.length >= MAX_PAYMENT_ROWS;

  return (
    <div className="space-y-4">
      {/* Head fields */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <header>
            <h2 className="text-base font-semibold text-ink">
              {t("contracts.compose.steps.step2.title")}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {t("contracts.compose.steps.step2.subtitle")}
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="compose-titleEn" className="block text-xs font-medium text-ink-muted">
                {t("contracts.fields.titleEn")}
                <span className="ms-1 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <Input
                id="compose-titleEn"
                type="text"
                {...form.register("titleEn")}
                disabled={disabled}
                maxLength={500}
                aria-invalid={!!form.formState.errors.titleEn}
                className="mt-1"
              />
              {form.formState.errors.titleEn?.message && (
                <p className="mt-1 text-[11px] text-destructive">
                  {t(form.formState.errors.titleEn.message as string)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="compose-titleAr" className="block text-xs font-medium text-ink-muted">
                {t("contracts.fields.titleAr")}
              </label>
              <Input
                id="compose-titleAr"
                type="text"
                dir="rtl"
                {...form.register("titleAr")}
                disabled={disabled}
                maxLength={500}
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="compose-valueAed"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.valueAed")}
              </label>
              <Input
                id="compose-valueAed"
                type="number"
                step="0.01"
                min={0}
                {...form.register("valueAed")}
                disabled={disabled}
                aria-invalid={!!form.formState.errors.valueAed}
                className="mt-1"
              />
              {form.formState.errors.valueAed?.message && (
                <p className="mt-1 text-[11px] text-destructive">
                  {t(form.formState.errors.valueAed.message as string)}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="compose-currency"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.currency")}
              </label>
              <Input
                id="compose-currency"
                type="text"
                {...form.register("currency")}
                disabled={disabled}
                maxLength={3}
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="compose-startDate"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.startDate")}
              </label>
              <Input
                id="compose-startDate"
                type="date"
                {...form.register("startDate")}
                disabled={disabled}
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="compose-endDate" className="block text-xs font-medium text-ink-muted">
                {t("contracts.fields.endDate")}
              </label>
              <Input
                id="compose-endDate"
                type="date"
                {...form.register("endDate")}
                disabled={disabled}
                aria-invalid={!!form.formState.errors.endDate}
                className="mt-1"
              />
              {form.formState.errors.endDate?.message && (
                <p className="mt-1 text-[11px] text-destructive">
                  {t(form.formState.errors.endDate.message as string)}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="compose-expiryNoticeDays"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.expiryNoticeDays")}
              </label>
              <Input
                id="compose-expiryNoticeDays"
                type="number"
                min={0}
                {...form.register("expiryNoticeDays")}
                disabled={disabled}
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="compose-emirate" className="block text-xs font-medium text-ink-muted">
                {t("contracts.fields.emirate")}
              </label>
              <Input
                id="compose-emirate"
                type="text"
                {...form.register("emirate")}
                disabled={disabled}
                maxLength={100}
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="compose-governingLaw"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.governingLaw")}
              </label>
              <select
                id="compose-governingLaw"
                {...form.register("governingLaw")}
                disabled={disabled}
                className={cn(
                  "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <option value="">{t("contracts.fields.notSet")}</option>
                {GOVERNING_LAW_VALUES.map((g) => (
                  <option key={g} value={g}>
                    {t(`contracts.governingLawOptions.${g}`, { defaultValue: g })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="compose-jurisdictionCourt"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.jurisdictionCourt")}
              </label>
              <Input
                id="compose-jurisdictionCourt"
                type="text"
                {...form.register("jurisdictionCourt")}
                disabled={disabled}
                maxLength={255}
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="compose-parentContractId"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.parentContractId")}
              </label>
              <Input
                id="compose-parentContractId"
                type="number"
                min={1}
                {...form.register("parentContractId")}
                disabled={disabled}
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="compose-relationshipType"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.relationshipType")}
              </label>
              <select
                id="compose-relationshipType"
                {...form.register("relationshipType")}
                disabled={disabled}
                className={cn(
                  "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <option value="">{t("contracts.fields.notSet")}</option>
                {RELATIONSHIP_TYPE_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {t(`contracts.relationshipTypeOptions.${r}`, { defaultValue: r })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment schedule sub-table */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink">
                {t("contracts.paymentSchedule.title")}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">
                {t("contracts.paymentSchedule.subtitle")}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append(emptyRow() as never)}
              disabled={addDisabled}
              aria-label={t("contracts.paymentSchedule.addRow")}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("contracts.paymentSchedule.addRow")}
            </Button>
          </header>

          {fields.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-ink-muted">
              {t("contracts.paymentSchedule.empty")}
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((row, index) => {
                const rowErrors = form.formState.errors.paymentSchedule?.[index];
                return (
                  <div key={row.id} className="rounded-md border border-border bg-surface/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink-muted">
                        {t("contracts.paymentSchedule.rowLabel", { n: index + 1 })}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(index)}
                        disabled={disabled}
                        aria-label={t("contracts.paymentSchedule.removeRow", { n: index + 1 })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`row-${index}-labelEn`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.milestoneLabelEn")}
                          <span className="ms-1 text-destructive" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <Input
                          id={`row-${index}-labelEn`}
                          type="text"
                          {...form.register(`paymentSchedule.${index}.milestoneLabelEn` as const)}
                          disabled={disabled}
                          maxLength={255}
                          aria-invalid={!!rowErrors?.milestoneLabelEn}
                          className="mt-1"
                        />
                        {rowErrors?.milestoneLabelEn?.message && (
                          <p className="mt-1 text-[10px] text-destructive">
                            {t(rowErrors.milestoneLabelEn.message as string)}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-labelAr`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.milestoneLabelAr")}
                        </label>
                        <Input
                          id={`row-${index}-labelAr`}
                          type="text"
                          dir="rtl"
                          {...form.register(`paymentSchedule.${index}.milestoneLabelAr` as const)}
                          disabled={disabled}
                          maxLength={255}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-amount`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.amountAed")}
                          <span className="ms-1 text-destructive" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <Input
                          id={`row-${index}-amount`}
                          type="number"
                          step="0.01"
                          min={0}
                          {...form.register(`paymentSchedule.${index}.amountAed` as const)}
                          disabled={disabled}
                          aria-invalid={!!rowErrors?.amountAed}
                          className="mt-1"
                        />
                        {rowErrors?.amountAed?.message && (
                          <p className="mt-1 text-[10px] text-destructive">
                            {t(rowErrors.amountAed.message as string)}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-due`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.dueDate")}
                        </label>
                        <Input
                          id={`row-${index}-due`}
                          type="date"
                          {...form.register(`paymentSchedule.${index}.dueDate` as const)}
                          disabled={disabled}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-status`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.status")}
                        </label>
                        <select
                          id={`row-${index}-status`}
                          {...form.register(`paymentSchedule.${index}.status` as const)}
                          disabled={disabled}
                          className={cn(
                            "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                        >
                          {PAYMENT_SCHEDULE_STATUS_VALUES.map((s) => (
                            <option key={s} value={s}>
                              {t(`contracts.paymentSchedule.statusOptions.${s}`, {
                                defaultValue: s,
                              })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-recurrence`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.recurrence")}
                        </label>
                        <select
                          id={`row-${index}-recurrence`}
                          {...form.register(`paymentSchedule.${index}.recurrence` as const)}
                          disabled={disabled}
                          className={cn(
                            "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                        >
                          <option value="">{t("contracts.fields.notSet")}</option>
                          {PAYMENT_SCHEDULE_RECURRENCE_VALUES.map((r) => (
                            <option key={r} value={r}>
                              {t(`contracts.paymentSchedule.recurrenceOptions.${r}`, {
                                defaultValue: r,
                              })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`row-${index}-invoice`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.invoiceRef")}
                        </label>
                        <Input
                          id={`row-${index}-invoice`}
                          type="text"
                          {...form.register(`paymentSchedule.${index}.invoiceRef` as const)}
                          disabled={disabled}
                          maxLength={100}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {fields.length >= MAX_PAYMENT_ROWS && (
            <p className="text-[11px] text-amber-ink">
              {t("contracts.paymentSchedule.errors.tooManyRows")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Re-export the unused recurrence type so consumers can import alongside
// the component if needed; the wizard parent doesn't need it directly.
export type { PaymentScheduleRecurrence };

export default Step2Parties;
