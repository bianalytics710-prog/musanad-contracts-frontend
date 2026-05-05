/**
 * Zod schemas for the regulatory_update create/edit forms (S8, S9).
 * Mirrors workspace/schemas.ts createRegulatoryUpdateSchema +
 * updateRegulatoryUpdateSchema as FE-side defence-in-depth.
 */
import { z } from "zod";
import { REGULATORY_SEVERITY_VALUES } from "@/types/entities/regulatory.types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? null : v));

const optionalDate = z
  .union([z.string().regex(ISO_DATE_RE, "Invalid date"), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const optionalUrl = z
  .union([z.string().url("regulatory.errors.invalidUrl"), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const regulatoryUpdateCreateSchema = z
  .object({
    regulatorId: z.coerce
      .number({ message: "regulatory.errors.regulatorRequired" })
      .int()
      .positive(),
    titleEn: z
      .string()
      .min(1, "regulatory.errors.titleEnRequired")
      .max(500, "regulatory.errors.titleEnTooLong"),
    titleAr: optionalString,
    summaryEn: optionalString,
    summaryAr: optionalString,
    referenceNumber: optionalString,
    publishedDate: z
      .string()
      .regex(ISO_DATE_RE, "regulatory.errors.publishedDateRequired"),
    effectiveDate: optionalDate,
    complianceDeadline: optionalDate,
    severity: z
      .enum(REGULATORY_SEVERITY_VALUES as unknown as [string, ...string[]])
      .default("medium"),
    sourceUrl: optionalUrl,
    affectedClauseCategories: z.string().optional(), // comma-separated
    categoryId: z
      .union([z.coerce.number().int().positive(), z.literal("")])
      .optional()
      .transform((v) => (typeof v === "number" ? v : null)),
    subSource: optionalString,
  })
  .superRefine((data, ctx) => {
    // AC-S8-03 — effectiveDate >= publishedDate
    if (data.effectiveDate && data.effectiveDate < data.publishedDate) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveDate"],
        message: "regulatory.errors.effectiveBeforePublished",
      });
    }
    // AC-S8-04 — complianceDeadline >= publishedDate
    if (data.complianceDeadline && data.complianceDeadline < data.publishedDate) {
      ctx.addIssue({
        code: "custom",
        path: ["complianceDeadline"],
        message: "regulatory.errors.deadlineBeforePublished",
      });
    }
  });

export type RegulatoryUpdateCreateFormData = z.input<
  typeof regulatoryUpdateCreateSchema
>;

export const regulatoryUpdateEditSchema = regulatoryUpdateCreateSchema;

export type RegulatoryUpdateEditFormData = z.input<
  typeof regulatoryUpdateEditSchema
>;

export function parseClauseCategories(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
