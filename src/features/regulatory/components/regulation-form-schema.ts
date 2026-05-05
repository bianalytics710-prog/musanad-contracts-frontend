/**
 * Zod schema for the create/edit regulation forms (S3, S4).
 *
 * Mirrors createRegulationSchema in workspace/schemas.ts as the FE-side
 * defence-in-depth — the BE Zod schema is the source of truth, but
 * client-side validation gives instant field-level feedback (T8).
 */
import { z } from "zod";
import {
  REGULATION_JURISDICTION_VALUES,
  REGULATION_STATUS_VALUES,
  REGULATION_TYPE_VALUES,
} from "@/types/entities/regulatory.types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const optionalDate = z
  .union([z.string().regex(ISO_DATE_RE, "Invalid date format"), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? null : v));

export const regulationCreateSchema = z.object({
  referenceCode: z
    .string()
    .min(1, "regulatory.errors.referenceCodeRequired")
    .max(64, "regulatory.errors.referenceCodeTooLong"),
  titleEn: z
    .string()
    .min(1, "regulatory.errors.titleEnRequired")
    .max(500, "regulatory.errors.titleEnTooLong"),
  titleAr: optionalString,
  issuerId: z.coerce
    .number({ message: "regulatory.errors.issuerRequired" })
    .int()
    .positive(),
  regulationType: z.enum(
    REGULATION_TYPE_VALUES as unknown as [string, ...string[]],
  ),
  jurisdiction: z
    .union([
      z.enum(REGULATION_JURISDICTION_VALUES as unknown as [string, ...string[]]),
      z.literal(""),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  effectiveDate: optionalDate,
  summaryEn: optionalString,
  summaryAr: optionalString,
  sourceUrl: z
    .union([z.string().url("regulatory.errors.invalidUrl"), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  tags: z.string().optional(), // comma-separated; transformed below
  status: z
    .enum(REGULATION_STATUS_VALUES as unknown as [string, ...string[]])
    .default("active"),
});

export type RegulationCreateFormData = z.input<typeof regulationCreateSchema>;
export type RegulationCreateOutput = z.output<typeof regulationCreateSchema>;

/** Edit form: same schema but referenceCode is omitted (immutable per AC-S4-05). */
export const regulationEditSchema = regulationCreateSchema.omit({
  referenceCode: true,
});

export type RegulationEditFormData = z.input<typeof regulationEditSchema>;
export type RegulationEditOutput = z.output<typeof regulationEditSchema>;

/** Comma-split helper for tags input. */
export function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
