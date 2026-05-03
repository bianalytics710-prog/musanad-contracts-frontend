/**
 * PaymentScheduleEditor (S3) — Modal bulk-replace editor for milestones.
 *
 * Mode: regenerate — fresh component tied to v2.6 patterns. Reuses the
 * row-edit UX from Step2Parties (compose wizard) but rendered as a modal
 * triggered from PaymentScheduleTab on the contract detail page.
 *
 * AC mapping:
 *   AC-S3-01: PUT /contracts/:id/payment-schedules with replaceExisting:true
 *             — atomic soft-delete + insert in a single transaction.
 *   AC-S3-04..S3-09: client-side Zod row validation mirrors BE messages.
 *   AC-S3-10: server emits 'payment_schedule_replaced' contract_activity row.
 *
 * The editor opens prepopulated with the current schedule (passed in via
 * `initialRows` prop) so the user sees what they're replacing. There is no
 * separate "delete row" mutation — removing a row from the array and
 * Saving does the soft-delete server-side.
 *
 * Bulk replace IS destructive (data is soft-deleted) but it is NOT a
 * window.confirm()-style destructive action — the explicit Save button
 * IS the confirmation. T9 doesn't apply here. Per the agent prompt:
 * "T9 — N/A for M1b (no destructive ops; bulk replace on payment schedule
 *  has its own confirmation)".
 *
 * Focus management: useFocusTrap (FE-C4 fix) holds Tab/Shift+Tab inside
 * the modal. Escape closes (when not mid-mutation). Click-outside closes
 * (when not mid-mutation).
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/components/common/useFocusTrap";
import { useReplacePaymentSchedule } from "@/features/contracts/hooks/usePaymentSchedule";
import { paymentScheduleRowSchema } from "@/features/contracts/wizard/compose-wizard-schemas";
import { cn } from "@/lib/utils";
import {
  PAYMENT_SCHEDULE_RECURRENCE_VALUES,
  PAYMENT_SCHEDULE_STATUS_VALUES,
  type PaymentSchedule,
  type PaymentScheduleCreateDto,
} from "@/types/entities/payment-schedule.types";

const MAX_ROWS = 100;

const editorSchema = z.object({
  rows: z
    .array(paymentScheduleRowSchema)
    .min(1, "contracts.paymentSchedule.errors.atLeastOneRow")
    .max(MAX_ROWS, "contracts.paymentSchedule.errors.tooManyRows"),
});

type EditorFormData = z.infer<typeof editorSchema>;

interface PaymentScheduleEditorProps {
  contractId: number;
  /** Pre-populate the editor with the contract's current schedule. */
  initialRows: PaymentSchedule[];
  open: boolean;
  onClose: () => void;
}

/** Convert a server PaymentSchedule into the editor's row shape. */
function toFormRow(row: PaymentSchedule): PaymentScheduleCreateDto {
  return {
    milestoneLabelEn: row.milestoneLabelEn,
    milestoneLabelAr: row.milestoneLabelAr,
    milestoneNameEn: row.milestoneNameEn,
    milestoneNameAr: row.milestoneNameAr,
    amountAed: row.amountAed,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    status: row.status,
    recurrence: row.recurrence,
    invoiceRef: row.invoiceRef,
  };
}

function emptyRow(): PaymentScheduleCreateDto {
  return {
    milestoneLabelEn: "",
    milestoneLabelAr: null,
    milestoneNameEn: null,
    milestoneNameAr: null,
    amountAed: 0,
    dueDate: null,
    paidAt: null,
    status: "pending",
    recurrence: null,
    invoiceRef: null,
  };
}

export function PaymentScheduleEditor({
  contractId,
  initialRows,
  open,
  onClose,
}: PaymentScheduleEditorProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const seedRows = useMemo<PaymentScheduleCreateDto[]>(
    () => (initialRows.length > 0 ? initialRows.map(toFormRow) : [emptyRow()]),
    [initialRows],
  );

  const form = useForm<EditorFormData>({
    resolver: zodResolver(editorSchema) as never,
    mode: "onBlur",
    defaultValues: { rows: seedRows },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rows",
  });

  const mutation = useReplacePaymentSchedule({
    onSuccess: () => onClose(),
  });

  // Reset to seed values whenever the modal re-opens.
  useEffect(() => {
    if (open) {
      form.reset({ rows: seedRows });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus-trap (FE-C4) — only while the dialog is mounted + open.
  useFocusTrap(dialogRef, open);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mutation.isPending, onClose]);

  if (!open) return null;

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate({
      contractId,
      data: {
        rows: data.rows as PaymentScheduleCreateDto[],
        replaceExisting: true,
      },
    });
  });

  const addDisabled = mutation.isPending || fields.length >= MAX_ROWS;

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
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {t("contracts.paymentSchedule.editorTitle")}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {t("contracts.paymentSchedule.editorSubtitle")}
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

        <form noValidate onSubmit={onSubmit} className="flex max-h-[70vh] flex-col">
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-ink-muted">
                {t("contracts.paymentSchedule.editorHint", { count: fields.length })}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append(emptyRow() as never)}
                disabled={addDisabled}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("contracts.paymentSchedule.addRow")}
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((row, index) => {
                const rowErrors = form.formState.errors.rows?.[index];
                return (
                  <div key={row.id} className="rounded-md border border-border bg-surface/30 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink-muted">
                        {t("contracts.paymentSchedule.rowLabel", { n: index + 1 })}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(index)}
                        disabled={mutation.isPending || fields.length === 1}
                        aria-label={t("contracts.paymentSchedule.removeRow", { n: index + 1 })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`editor-${index}-labelEn`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.milestoneLabelEn")}
                          <span className="ms-1 text-destructive" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <Input
                          id={`editor-${index}-labelEn`}
                          type="text"
                          {...form.register(`rows.${index}.milestoneLabelEn` as const)}
                          disabled={mutation.isPending}
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
                          htmlFor={`editor-${index}-labelAr`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.milestoneLabelAr")}
                        </label>
                        <Input
                          id={`editor-${index}-labelAr`}
                          type="text"
                          dir="rtl"
                          {...form.register(`rows.${index}.milestoneLabelAr` as const)}
                          disabled={mutation.isPending}
                          maxLength={255}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`editor-${index}-amount`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.amountAed")}
                          <span className="ms-1 text-destructive" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <Input
                          id={`editor-${index}-amount`}
                          type="number"
                          step="0.01"
                          min={0}
                          {...form.register(`rows.${index}.amountAed` as const)}
                          disabled={mutation.isPending}
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
                          htmlFor={`editor-${index}-due`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.dueDate")}
                        </label>
                        <Input
                          id={`editor-${index}-due`}
                          type="date"
                          {...form.register(`rows.${index}.dueDate` as const)}
                          disabled={mutation.isPending}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`editor-${index}-status`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.status")}
                        </label>
                        <select
                          id={`editor-${index}-status`}
                          {...form.register(`rows.${index}.status` as const)}
                          disabled={mutation.isPending}
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
                          htmlFor={`editor-${index}-recurrence`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.recurrence")}
                        </label>
                        <select
                          id={`editor-${index}-recurrence`}
                          {...form.register(`rows.${index}.recurrence` as const)}
                          disabled={mutation.isPending}
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
                          htmlFor={`editor-${index}-invoice`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.invoiceRef")}
                        </label>
                        <Input
                          id={`editor-${index}-invoice`}
                          type="text"
                          {...form.register(`rows.${index}.invoiceRef` as const)}
                          disabled={mutation.isPending}
                          maxLength={100}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {form.formState.errors.rows?.message && (
              <p className="mt-3 text-[11px] text-destructive">
                {t(form.formState.errors.rows.message as string)}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-surface/50 px-5 py-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("common.saving") : t("contracts.paymentSchedule.saveButton")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PaymentScheduleEditor;
