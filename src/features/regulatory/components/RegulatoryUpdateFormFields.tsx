/**
 * Shared field set for RegulatoryUpdateCreateForm (S8) +
 * RegulatoryUpdateEditForm (S9). Includes the ImpactCategoryPicker (S14).
 */
import { useTranslation } from "react-i18next";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { REGULATORY_SEVERITY_VALUES } from "@/types/entities/regulatory.types";
import type {
  ImpactCategory,
  RegulatorRef,
} from "@/types/entities/regulatory.types";
import type { RegulatoryUpdateCreateFormData } from "./regulatory-update-form-schema";

interface Props {
  register: UseFormRegister<RegulatoryUpdateCreateFormData>;
  errors: FieldErrors<RegulatoryUpdateCreateFormData>;
  disabled?: boolean;
  regulators: RegulatorRef[];
  categories: ImpactCategory[];
}

export function RegulatoryUpdateFormFields({
  register,
  errors,
  disabled,
  regulators,
  categories,
}: Props) {
  const { t } = useTranslation();
  const errKey = (k: string | undefined): string | undefined =>
    k ? t(k, { defaultValue: k }) : undefined;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label={t("regulatory.regulatoryUpdate.fields.regulator")}
        required
        error={errKey(errors.regulatorId?.message)}
      >
        <select
          {...register("regulatorId")}
          disabled={disabled}
          aria-invalid={errors.regulatorId ? "true" : "false"}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">
            {t("regulatory.regulatoryUpdate.placeholders.selectRegulator")}
          </option>
          {regulators.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.nameEn}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.severity")}
        error={errKey(errors.severity?.message)}
      >
        <select
          {...register("severity")}
          disabled={disabled}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {REGULATORY_SEVERITY_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`regulatory.regulatoryUpdate.severity.${v}`)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.titleEn")}
        required
        error={errKey(errors.titleEn?.message)}
        wide
      >
        <Input
          type="text"
          {...register("titleEn")}
          disabled={disabled}
          aria-invalid={errors.titleEn ? "true" : "false"}
        />
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.titleAr")}
        error={errKey(errors.titleAr?.message)}
        wide
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
        label={t("regulatory.regulatoryUpdate.fields.publishedDate")}
        required
        error={errKey(errors.publishedDate?.message)}
      >
        <Input
          type="date"
          {...register("publishedDate")}
          disabled={disabled}
          aria-invalid={errors.publishedDate ? "true" : "false"}
        />
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.effectiveDate")}
        error={errKey(errors.effectiveDate?.message)}
      >
        <Input
          type="date"
          {...register("effectiveDate")}
          disabled={disabled}
        />
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.complianceDeadline")}
        error={errKey(errors.complianceDeadline?.message)}
      >
        <Input
          type="date"
          {...register("complianceDeadline")}
          disabled={disabled}
        />
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.referenceNumber")}
        error={errKey(errors.referenceNumber?.message)}
      >
        <Input
          type="text"
          {...register("referenceNumber")}
          disabled={disabled}
        />
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.category")}
        error={errKey(errors.categoryId?.message)}
      >
        <select
          {...register("categoryId")}
          disabled={disabled}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">
            {t("regulatory.regulatoryUpdate.placeholders.noCategory")}
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameEn}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.subSource")}
        error={errKey(errors.subSource?.message)}
      >
        <Input type="text" {...register("subSource")} disabled={disabled} />
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.affectedClauseCategories")}
        error={errKey(errors.affectedClauseCategories?.message)}
        helpText={t(
          "regulatory.regulatoryUpdate.helpText.affectedClauseCategoriesCommaSeparated",
        )}
        wide
      >
        <Input
          type="text"
          {...register("affectedClauseCategories")}
          disabled={disabled}
          placeholder="termination, payment, indemnity"
        />
      </Field>

      <Field
        label={t("regulatory.regulatoryUpdate.fields.sourceUrl")}
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
        label={t("regulatory.regulatoryUpdate.fields.summaryEn")}
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
        label={t("regulatory.regulatoryUpdate.fields.summaryAr")}
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

function Field({
  label,
  required,
  error,
  helpText,
  wide,
  children,
}: FieldProps) {
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
