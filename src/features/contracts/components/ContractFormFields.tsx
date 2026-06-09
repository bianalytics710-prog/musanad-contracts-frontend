/**
 * ContractFormFields — shared field set used by both ContractCreateForm (S3)
 * and ContractEditForm (S4). Encapsulates the Zod schema, react-hook-form
 * registration, and accessible label/error rendering for every contract
 * editable field.
 *
 * Status is excluded by design — that route is /api/v1/contracts/:id/status
 * via a dedicated dialog (S6). Tags are also excluded — managed via
 * /api/v1/contracts/:id/tags (S8).
 *
 * T7  Strict TS — schema infers FormData type used by both forms.
 * T8  zodResolver wired in the consumer; here we own field shape + rules.
 * T13 bodyEn/bodyAr are SENSITIVE — they live in form state but are never
 *     console.logged. The `<textarea>`s do not log values; we DO NOT wrap
 *     them in any debug logger.
 */
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CONTRACT_LANGUAGE_VALUES,
  GOVERNING_LAW_VALUES,
  RELATIONSHIP_TYPE_VALUES,
} from "@/types/entities/contract.types";
import type { ContractCreateFormData, ContractEditFormData } from "./contract-form-schema";

// Use the broader type for the field component so it accepts either.
// The shape is structurally compatible — every property is optional in edit
// mode and required-or-optional in create mode at the consumer level.
type AnyContractFormData = ContractCreateFormData & ContractEditFormData;

interface ContractFormFieldsProps {
  register: UseFormRegister<AnyContractFormData>;
  errors: FieldErrors<AnyContractFormData>;
  disabled?: boolean;
  /** When true, mark titleEn + contractType inputs as required (create mode). */
  requireCore?: boolean;
}

export function ContractFormFields({
  register,
  errors,
  disabled,
  requireCore,
}: ContractFormFieldsProps) {
  const { t } = useTranslation();
  const ids = {
    titleEn: useId(),
    titleAr: useId(),
    contractType: useId(),
    language: useId(),
    governingLaw: useId(),
    relationshipType: useId(),
    valueAed: useId(),
    currency: useId(),
    startDate: useId(),
    endDate: useId(),
    expiryNoticeDays: useId(),
    emirate: useId(),
    jurisdictionCourt: useId(),
    parentContractId: useId(),
    bodyEn: useId(),
    bodyAr: useId(),
  };

  /**
   * Translate an error message that is itself a translation key. The Zod
   * schema stores keys (e.g. 'contracts.form.errors.titleEnRequired') so a
   * single source of truth handles both EN and AR.
   */
  const errMsg = (m: string | undefined): string | undefined =>
    m ? t(m, { defaultValue: m }) : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        id={ids.titleEn}
        label={t("contracts.fields.titleEn")}
        required={requireCore}
        error={errMsg(errors.titleEn?.message)}
      >
        <Input id={ids.titleEn} type="text" disabled={disabled} {...register("titleEn")} />
      </Field>

      <Field
        id={ids.titleAr}
        label={t("contracts.fields.titleAr")}
        error={errMsg(errors.titleAr?.message)}
      >
        <Input
          id={ids.titleAr}
          type="text"
          dir="rtl"
          disabled={disabled}
          {...register("titleAr")}
        />
      </Field>

      <Field
        id={ids.contractType}
        label={t("contracts.fields.contractType")}
        required={requireCore}
        error={errMsg(errors.contractType?.message)}
      >
        <Input
          id={ids.contractType}
          type="text"
          disabled={disabled}
          {...register("contractType")}
        />
      </Field>

      <Field
        id={ids.language}
        label={t("contracts.fields.language")}
        error={errMsg(errors.language?.message)}
      >
        <select
          id={ids.language}
          disabled={disabled}
          {...register("language")}
          className={selectClass}
        >
          {CONTRACT_LANGUAGE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`contracts.languageOptions.${v}`, { defaultValue: v })}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id={ids.valueAed}
        label={t("contracts.fields.valueAed")}
        error={errMsg(errors.valueAed?.message)}
      >
        <Input
          id={ids.valueAed}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          disabled={disabled}
          {...register("valueAed")}
        />
      </Field>

      <Field
        id={ids.currency}
        label={t("contracts.fields.currency")}
        error={errMsg(errors.currency?.message)}
      >
        <Input
          id={ids.currency}
          type="text"
          maxLength={3}
          disabled={disabled}
          placeholder="AED"
          {...register("currency")}
        />
      </Field>

      <Field
        id={ids.startDate}
        label={t("contracts.fields.startDate")}
        error={errMsg(errors.startDate?.message)}
      >
        <Input id={ids.startDate} type="date" disabled={disabled} {...register("startDate")} />
      </Field>

      <Field
        id={ids.endDate}
        label={t("contracts.fields.endDate")}
        error={errMsg(errors.endDate?.message)}
      >
        <Input id={ids.endDate} type="date" disabled={disabled} {...register("endDate")} />
      </Field>

      <Field
        id={ids.expiryNoticeDays}
        label={t("contracts.fields.expiryNoticeDays")}
        error={errMsg(errors.expiryNoticeDays?.message)}
      >
        <Input
          id={ids.expiryNoticeDays}
          type="number"
          min={0}
          step={1}
          disabled={disabled}
          {...register("expiryNoticeDays")}
        />
      </Field>

      <Field
        id={ids.emirate}
        label={t("contracts.fields.emirate")}
        error={errMsg(errors.emirate?.message)}
      >
        <Input id={ids.emirate} type="text" disabled={disabled} {...register("emirate")} />
      </Field>

      <Field
        id={ids.governingLaw}
        label={t("contracts.fields.governingLaw")}
        error={errMsg(errors.governingLaw?.message)}
      >
        <select
          id={ids.governingLaw}
          disabled={disabled}
          {...register("governingLaw")}
          className={selectClass}
        >
          <option value="">{t("contracts.fields.notSet")}</option>
          {GOVERNING_LAW_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`contracts.governingLawOptions.${v}`, { defaultValue: v })}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id={ids.jurisdictionCourt}
        label={t("contracts.fields.jurisdictionCourt")}
        error={errMsg(errors.jurisdictionCourt?.message)}
      >
        <Input
          id={ids.jurisdictionCourt}
          type="text"
          disabled={disabled}
          {...register("jurisdictionCourt")}
        />
      </Field>

      <Field
        id={ids.parentContractId}
        label={t("contracts.fields.parentContractId")}
        error={errMsg(errors.parentContractId?.message)}
      >
        <Input
          id={ids.parentContractId}
          type="number"
          min={1}
          step={1}
          disabled={disabled}
          {...register("parentContractId")}
        />
      </Field>

      <Field
        id={ids.relationshipType}
        label={t("contracts.fields.relationshipType")}
        error={errMsg(errors.relationshipType?.message)}
      >
        <select
          id={ids.relationshipType}
          disabled={disabled}
          {...register("relationshipType")}
          className={selectClass}
        >
          <option value="">{t("contracts.fields.notSet")}</option>
          {RELATIONSHIP_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`contracts.relationshipTypeOptions.${v}`, { defaultValue: v })}
            </option>
          ))}
        </select>
      </Field>

      {/* Body fields full-width — sensitive (T13) */}
      <div className="sm:col-span-2">
        <Field
          id={ids.bodyEn}
          label={t("contracts.fields.bodyEn")}
          error={errMsg(errors.bodyEn?.message)}
          help={t("contracts.fields.bodyHelp")}
        >
          <textarea
            id={ids.bodyEn}
            rows={28}
            disabled={disabled}
            {...register("bodyEn")}
            className={cn(
              textareaClass,
              // v611 — contract bodies are ~10–20k chars of markdown;
              // the previous 6-row textarea was unusable for finding
              // and editing a single clause. Tall monospace editor
              // with resize handle so drafters can work inline.
              "min-h-[480px] max-h-[80vh] resize-y font-mono leading-relaxed",
            )}
          />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field
          id={ids.bodyAr}
          label={t("contracts.fields.bodyAr")}
          error={errMsg(errors.bodyAr?.message)}
        >
          <textarea
            id={ids.bodyAr}
            rows={28}
            dir="rtl"
            disabled={disabled}
            {...register("bodyAr")}
            className={cn(
              textareaClass,
              // v611 — see bodyEn comment above. Same treatment for the
              // Arabic body; RTL preserved.
              "min-h-[480px] max-h-[80vh] resize-y font-mono leading-relaxed",
            )}
          />
        </Field>
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  children: React.ReactNode;
}

function Field({ id, label, required, error, help, children }: FieldProps) {
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
        {label}
        {required && (
          <span className="ms-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {/* Inject aria-describedby via cloning is brittle; let the consumer's
          element receive aria-* via an external selector once. For now the
          error text uses role="alert" to be announced when present. */}
      {children}
      {help && (
        <p id={helpId} className="text-[11px] text-ink-subtle">
          {help}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-[11px] font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const selectClass = cn(
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const textareaClass = cn(
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "placeholder:text-muted-foreground",
);
