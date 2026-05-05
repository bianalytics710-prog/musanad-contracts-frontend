/**
 * Shared form field set used by RegulationCreateDialog (S3) +
 * RegulationEditDialog (S4). The `mode` prop controls visibility of the
 * referenceCode field — immutable per AC-S4-05.
 */
import { useTranslation } from "react-i18next";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  REGULATION_JURISDICTION_VALUES,
  REGULATION_STATUS_VALUES,
  REGULATION_TYPE_VALUES,
} from "@/types/entities/regulatory.types";
import type { RegulatorRef } from "@/types/entities/regulatory.types";
import type { RegulationCreateFormData } from "./regulation-form-schema";

interface Props {
  mode: "create" | "edit";
  register: UseFormRegister<RegulationCreateFormData>;
  errors: FieldErrors<RegulationCreateFormData>;
  disabled?: boolean;
  regulators: RegulatorRef[];
}

export function RegulationFormFields({
  mode,
  register,
  errors,
  disabled,
  regulators,
}: Props) {
  const { t } = useTranslation();
  const errKey = (k: string | undefined): string | undefined =>
    k ? t(k, { defaultValue: k }) : undefined;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {mode === "create" && (
        <Field
          label={t("regulatory.regulation.fields.referenceCode")}
          required
          error={errKey(errors.referenceCode?.message)}
        >
          <Input
            type="text"
            {...register("referenceCode")}
            disabled={disabled}
            aria-invalid={errors.referenceCode ? "true" : "false"}
            placeholder={t(
              "regulatory.regulation.placeholders.referenceCode",
            )}
          />
        </Field>
      )}

      <Field
        label={t("regulatory.regulation.fields.titleEn")}
        required
        error={errKey(errors.titleEn?.message)}
      >
        <Input
          type="text"
          {...register("titleEn")}
          disabled={disabled}
          aria-invalid={errors.titleEn ? "true" : "false"}
        />
      </Field>

      <Field
        label={t("regulatory.regulation.fields.titleAr")}
        error={errKey(errors.titleAr?.message)}
      >
        <Input
          type="text"
          dir="rtl"
          lang="ar"
          {...register("titleAr")}
          disabled={disabled}
        />
      </Field>

      <Field
        label={t("regulatory.regulation.fields.issuer")}
        required
        error={errKey(errors.issuerId?.message)}
      >
        <select
          {...register("issuerId")}
          disabled={disabled}
          aria-invalid={errors.issuerId ? "true" : "false"}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">
            {t("regulatory.regulation.placeholders.selectIssuer")}
          </option>
          {regulators.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.nameEn}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t("regulatory.regulation.fields.regulationType")}
        required
        error={errKey(errors.regulationType?.message)}
      >
        <select
          {...register("regulationType")}
          disabled={disabled}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">
            {t("regulatory.regulation.placeholders.selectType")}
          </option>
          {REGULATION_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`regulatory.regulation.regulationType.${v}`)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t("regulatory.regulation.fields.jurisdiction")}
        error={errKey(errors.jurisdiction?.message)}
      >
        <select
          {...register("jurisdiction")}
          disabled={disabled}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">
            {t("regulatory.regulation.placeholders.selectJurisdiction")}
          </option>
          {REGULATION_JURISDICTION_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`regulatory.regulation.jurisdiction.${v}`)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t("regulatory.regulation.fields.effectiveDate")}
        error={errKey(errors.effectiveDate?.message)}
      >
        <Input type="date" {...register("effectiveDate")} disabled={disabled} />
      </Field>

      <Field
        label={t("regulatory.regulation.fields.status")}
        error={errKey(errors.status?.message)}
      >
        <select
          {...register("status")}
          disabled={disabled}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {REGULATION_STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`regulatory.regulation.status.${v}`)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t("regulatory.regulation.fields.sourceUrl")}
        error={errKey(errors.sourceUrl?.message)}
        wide
      >
        <Input
          type="url"
          {...register("sourceUrl")}
          disabled={disabled}
          placeholder="https://..."
        />
      </Field>

      <Field
        label={t("regulatory.regulation.fields.tags")}
        error={errKey(errors.tags?.message)}
        helpText={t("regulatory.regulation.helpText.tagsCommaSeparated")}
        wide
      >
        <Input
          type="text"
          {...register("tags")}
          disabled={disabled}
          placeholder="federal, employment, 2025"
        />
      </Field>

      <Field
        label={t("regulatory.regulation.fields.summaryEn")}
        error={errKey(errors.summaryEn?.message)}
        wide
      >
        <textarea
          {...register("summaryEn")}
          disabled={disabled}
          rows={4}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>

      <Field
        label={t("regulatory.regulation.fields.summaryAr")}
        error={errKey(errors.summaryAr?.message)}
        wide
      >
        <textarea
          {...register("summaryAr")}
          disabled={disabled}
          rows={4}
          dir="rtl"
          lang="ar"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  wide?: boolean;
  children: React.ReactNode;
}

function Field({ label, required, error, helpText, wide, children }: FieldProps) {
  return (
    <label
      className={`flex flex-col gap-1 text-sm ${wide ? "md:col-span-2" : ""}`}
    >
      <span className="font-medium text-ink">
        {label}
        {required && (
          <span className="ms-0.5 text-terracotta" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
      {helpText && !error && (
        <span className="text-xs text-ink-muted">{helpText}</span>
      )}
      {error && (
        <span role="alert" className="text-xs text-terracotta">
          {error}
        </span>
      )}
    </label>
  );
}
