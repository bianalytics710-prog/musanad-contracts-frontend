/**
 * Zod schemas + form-data types for ContractCreateForm (S3) and
 * ContractEditForm (S4). Lives in a separate file so the component file
 * exports only React components (react-refresh/only-export-components).
 */
import { z } from "zod";
import {
  CONTRACT_LANGUAGE_VALUES,
  GOVERNING_LAW_VALUES,
  RELATIONSHIP_TYPE_VALUES,
} from "@/types/entities/contract.types";

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
  z.number().nullable().optional(),
);

const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.union([z.string(), z.null()]).nullable().optional(),
);

/** Full schema — used by ContractCreateForm. titleEn + contractType required. */
export const contractCreateSchema = z
  .object({
    titleEn: z.string().trim().min(1, "contracts.form.errors.titleEnRequired"),
    titleAr: optionalString,
    contractType: z.string().trim().min(1, "contracts.form.errors.contractTypeRequired"),
    language: z.enum(CONTRACT_LANGUAGE_VALUES as unknown as [string, ...string[]]).optional(),
    governingLaw: z
      .union([z.enum(GOVERNING_LAW_VALUES as unknown as [string, ...string[]]), z.literal("")])
      .optional()
      .transform((v) => (v === "" ? null : (v ?? null))),
    relationshipType: z
      .union([z.enum(RELATIONSHIP_TYPE_VALUES as unknown as [string, ...string[]]), z.literal("")])
      .optional()
      .transform((v) => (v === "" ? null : (v ?? null))),
    valueAed: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
      z
        .number()
        .nullable()
        .refine((n) => n === null || n >= 0, {
          message: "contracts.form.errors.valueNonNegative",
        }),
    ),
    currency: optionalString,
    startDate: optionalString,
    endDate: optionalString,
    expiryNoticeDays: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
      z.number().int().min(0).optional(),
    ),
    emirate: optionalString,
    jurisdictionCourt: optionalString,
    parentContractId: optionalNumber,
    bodyEn: optionalString,
    bodyAr: optionalString,
  })
  .superRefine((val, ctx) => {
    if (val.startDate && val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "contracts.form.errors.endDateBeforeStart",
      });
    }
  });

/**
 * Partial schema — used by ContractEditForm.
 *
 * NOTE: titleEn + contractType are still rendered + pre-filled in the form,
 * so RHF always sends them. Treating them as required with min(1) gives
 * an inline field error the moment a user clears them — preventing the
 * silent BE 400 documented in the drafter E2E sweep (5.8).
 */
export const contractEditSchema = z
  .object({
    titleEn: z.string().trim().min(1, "contracts.form.errors.titleEnRequired"),
    titleAr: optionalString,
    contractType: z.string().trim().min(1, "contracts.form.errors.contractTypeRequired"),
    language: z.enum(CONTRACT_LANGUAGE_VALUES as unknown as [string, ...string[]]).optional(),
    governingLaw: z
      .union([z.enum(GOVERNING_LAW_VALUES as unknown as [string, ...string[]]), z.literal("")])
      .optional()
      .transform((v) => (v === "" ? null : (v ?? null))),
    relationshipType: z
      .union([z.enum(RELATIONSHIP_TYPE_VALUES as unknown as [string, ...string[]]), z.literal("")])
      .optional()
      .transform((v) => (v === "" ? null : (v ?? null))),
    valueAed: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
      z
        .number()
        .nullable()
        .refine((n) => n === null || n >= 0, {
          message: "contracts.form.errors.valueNonNegative",
        }),
    ),
    currency: optionalString,
    startDate: optionalString,
    endDate: optionalString,
    expiryNoticeDays: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
      z.number().int().min(0).optional(),
    ),
    emirate: optionalString,
    jurisdictionCourt: optionalString,
    parentContractId: optionalNumber,
    bodyEn: optionalString,
    bodyAr: optionalString,
  })
  .superRefine((val, ctx) => {
    if (val.startDate && val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "contracts.form.errors.endDateBeforeStart",
      });
    }
  });

export type ContractCreateFormData = z.infer<typeof contractCreateSchema>;
export type ContractEditFormData = z.infer<typeof contractEditSchema>;
