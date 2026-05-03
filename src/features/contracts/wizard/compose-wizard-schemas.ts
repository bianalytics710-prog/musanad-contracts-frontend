/**
 * Compose Wizard Zod schemas.
 *
 * One schema per step (Step1Type, Step2Parties, Step3ClausesBody) plus a
 * row-level schema for payment-schedule sub-table inside Step 2. Schemas
 * use the M1b activity / payment / contract enum tuples so step advance
 * (AC-S1-06) catches invalid required fields BEFORE Submit hits the BE.
 *
 * Step 4 (attachments) and Step 5 (review) have no validatable fields:
 *   - Step 4 is SKIPPED in M1b (AC-S1-01).
 *   - Step 5 is read-only review (AC-S1-05).
 *
 * Error messages are i18n keys, not English literals — translateApiError
 * pattern. The wizard renders them via t().
 */

import { z } from "zod";
import {
  CONTRACT_LANGUAGE_VALUES,
  GOVERNING_LAW_VALUES,
  RELATIONSHIP_TYPE_VALUES,
} from "@/types/entities/contract.types";
import {
  PAYMENT_SCHEDULE_RECURRENCE_VALUES,
  PAYMENT_SCHEDULE_STATUS_VALUES,
} from "@/types/entities/payment-schedule.types";

// ─── Common helpers ──────────────────────────────────────────────────────────

const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.union([z.string(), z.null()]).nullable().optional(),
);

const optionalNumberAllowEmpty = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
  z.number().nullable().optional(),
);

const optionalNonNegativeNumber = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
  z
    .number()
    .nullable()
    .refine((n) => n === null || n >= 0, {
      message: "contracts.form.errors.valueNonNegative",
    }),
);

// ─── Step 1 — Setup ──────────────────────────────────────────────────────────

/**
 * AC-S1-02: contractType + language required; party + template fields
 * captured as free-text but NOT validated against picker lookups (Q1
 * deferred picker decision). ourPartyName / counterpartyName / templateId
 * are intentionally permissive — they only become first-class once the
 * Parties / Templates modules ship.
 */
export const composeStep1Schema = z.object({
  contractType: z.string().trim().min(1, "contracts.form.errors.contractTypeRequired"),
  language: z.enum(CONTRACT_LANGUAGE_VALUES as unknown as [string, ...string[]]),
  ourPartyName: optionalString,
  counterpartyName: optionalString,
  templateId: optionalNumberAllowEmpty,
});

export type ComposeStep1FormData = z.infer<typeof composeStep1Schema>;

// ─── Step 2 — Key Terms (incl. payment-schedule sub-table) ────────────────────

/**
 * Single payment-schedule row inside Step 2's repeating sub-table.
 * Mirrors the BE PaymentScheduleCreateSchema field-level validation.
 *
 * AC-S3-05: milestoneLabelEn 1..255 chars.
 * AC-S3-06: amountAed >= 0.
 * AC-S3-07: status optional, in 6-value enum.
 * AC-S3-08: recurrence optional, in 4-value enum.
 */
export const paymentScheduleRowSchema = z.object({
  milestoneLabelEn: z
    .string()
    .trim()
    .min(1, "contracts.paymentSchedule.errors.milestoneLabelEnRequired")
    .max(255, "contracts.paymentSchedule.errors.milestoneLabelEnTooLong"),
  milestoneLabelAr: optionalString,
  milestoneNameEn: optionalString,
  milestoneNameAr: optionalString,
  amountAed: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z
      .number({ invalid_type_error: "contracts.paymentSchedule.errors.amountInvalid" })
      .min(0, "contracts.paymentSchedule.errors.amountNonNegative"),
  ),
  dueDate: optionalString,
  paidAt: optionalString,
  status: z
    .enum(PAYMENT_SCHEDULE_STATUS_VALUES as unknown as [string, ...string[]])
    .optional()
    .default("pending"),
  recurrence: z
    .union([
      z.enum(PAYMENT_SCHEDULE_RECURRENCE_VALUES as unknown as [string, ...string[]]),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  invoiceRef: optionalString,
});

export type PaymentScheduleRowFormData = z.infer<typeof paymentScheduleRowSchema>;

/**
 * AC-S1-03: titleEn required; titleAr / valueAed / startDate / endDate
 * optional. valueAed must be >=0 if present (AC-S3-06 mirror). Schedule
 * sub-array length not enforced here — wizard limits at the row-add UI
 * level (max 100 to match AC-S3-09).
 */
export const composeStep2Schema = z
  .object({
    titleEn: z.string().trim().min(1, "contracts.form.errors.titleEnRequired"),
    titleAr: optionalString,
    valueAed: optionalNonNegativeNumber,
    currency: optionalString,
    startDate: optionalString,
    endDate: optionalString,
    expiryNoticeDays: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
      z.number().int().min(0).optional(),
    ),
    emirate: optionalString,
    governingLaw: z
      .union([
        z.enum(GOVERNING_LAW_VALUES as unknown as [string, ...string[]]),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    jurisdictionCourt: optionalString,
    parentContractId: optionalNumberAllowEmpty,
    relationshipType: z
      .union([
        z.enum(RELATIONSHIP_TYPE_VALUES as unknown as [string, ...string[]]),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    paymentSchedule: z
      .array(paymentScheduleRowSchema)
      .max(100, "contracts.paymentSchedule.errors.tooManyRows"),
  })
  .superRefine((val, ctx) => {
    // Mirror M1a contract-form-schema endDateBeforeStart.
    if (val.startDate && val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "contracts.form.errors.endDateBeforeStart",
      });
    }
  });

export type ComposeStep2FormData = z.infer<typeof composeStep2Schema>;

// ─── Step 3 — Clauses / Body ─────────────────────────────────────────────────

/**
 * AC-S1-04: bodyEn / bodyAr both freeform optional. AI panel + clause
 * library are DISABLED in M1b — no validation needed.
 */
export const composeStep3Schema = z.object({
  bodyEn: optionalString,
  bodyAr: optionalString,
});

export type ComposeStep3FormData = z.infer<typeof composeStep3Schema>;
