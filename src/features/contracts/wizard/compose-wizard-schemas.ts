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
  // Compose-revamp v2 2026-06-03 — parties promoted from optional free-text
  // to required. Compose-without-parties produced contracts that couldn't be
  // routed for signature and broke downstream queries that join on party id.
  ourPartyName: z.string().trim().min(1, "contracts.form.errors.ourPartyNameRequired"),
  counterpartyName: z.string().trim().min(1, "contracts.form.errors.counterpartyNameRequired"),
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
    // Compose-revamp 2026-06-03 — values for the template's placeholder
    // catalog. Per-key required-ness is enforced at the wizard level
    // (Step2Parties evaluates against the template's `placeholders` array).
    placeholderValues: z.record(z.string(), z.string()).optional(),
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

/** Per-clause shape held in step3.selectedClauses. */
const selectedClauseSchema = z.object({
  clauseId: z.number().int().positive(),
  titleEn: z.string(),
  titleAr: z.string().nullable(),
  category: z.string(),
  variant: z.enum(["standard", "alternative", "fallback"]),
  bodyEn: z.string(),
  bodyAr: z.string().nullable(),
  sortOrder: z.number().int(),
  source: z.enum(["template", "manual"]),
});

/**
 * Compose-revamp 2026-06-03:
 *   - Step 3 is now a structured clause list + optional intro/closing
 *     blocks. The final bodyEn/bodyAr strings are derived at submit.
 *   - To pass validation, EITHER selectedClauses is non-empty OR an intro
 *     or closing block has content (so a "blank-draft" path stays viable).
 */
export const composeStep3Schema = z
  .object({
    bodyEn: optionalString,
    bodyAr: optionalString,
    selectedClauses: z.array(selectedClauseSchema).optional(),
    introEn: optionalString,
    introAr: optionalString,
    closingEn: optionalString,
    closingAr: optionalString,
    bodyLanguage: z.enum(["en", "ar"]).optional(),
  })
  .superRefine((val, ctx) => {
    const hasClauses = (val.selectedClauses?.length ?? 0) > 0;
    const intro =
      (typeof val.introEn === "string" && val.introEn.trim().length > 0) ||
      (typeof val.introAr === "string" && val.introAr.trim().length > 0);
    const closing =
      (typeof val.closingEn === "string" && val.closingEn.trim().length > 0) ||
      (typeof val.closingAr === "string" && val.closingAr.trim().length > 0);
    const legacyBody =
      (typeof val.bodyEn === "string" && val.bodyEn.trim().length > 0) ||
      (typeof val.bodyAr === "string" && val.bodyAr.trim().length > 0);
    if (!hasClauses && !intro && !closing && !legacyBody) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedClauses"],
        message: "contracts.compose.errors.bodyEmpty",
      });
    }
  });

export type ComposeStep3FormData = z.infer<typeof composeStep3Schema>;
