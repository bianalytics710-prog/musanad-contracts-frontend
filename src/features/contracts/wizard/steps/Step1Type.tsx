/**
 * Step1Type — Compose Wizard Step 1 (Setup).
 *
 * AC-S1-02:
 *   - contractType (required, free-text) — surfaced as a select in M1a;
 *     M1b retains free-text since no contract_type lookup table exists yet.
 *   - language (required, en|ar|bilingual)
 *   - ourPartyName + counterpartyName: free-text (TODO[parties-module])
 *   - templateId: disabled picker with deferred banner (TODO[templates-module])
 *
 * Step advance is controlled by the parent ComposeWizard via the form's
 * isValid signal — this component owns ONLY the Step 1 fields, not the
 * navigation chrome.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CONTRACT_LANGUAGE_VALUES } from "@/types/entities/contract.types";
import { composeStep1Schema, type ComposeStep1FormData } from "../compose-wizard-schemas";
import type { ComposeWizardStep1Type } from "@/types/entities/payment-schedule.types";

interface Step1TypeProps {
  /** Current state from the wizard parent (read-only props pattern). */
  value: ComposeWizardStep1Type;
  /** Emit normalised data on every valid change so the parent can persist drafts. */
  onChange: (next: ComposeWizardStep1Type) => void;
  /** Lock fields when the wizard is mid-submit. */
  disabled?: boolean;
}

export function Step1Type({ value, onChange, disabled = false }: Step1TypeProps) {
  const { t } = useTranslation();

  const form = useForm<ComposeStep1FormData>({
    resolver: zodResolver(composeStep1Schema) as never,
    mode: "onBlur",
    defaultValues: {
      contractType: value.contractType ?? "",
      language: value.language ?? "en",
      ourPartyName: value.ourPartyName ?? null,
      counterpartyName: value.counterpartyName ?? null,
      templateId: value.templateId ?? null,
    },
  });

  // Subscribe to RHF values and pipe them up to the parent. Using
  // form.watch with an object destructure causes a re-render every change
  // which is fine for a 5-field form; debounced persistence happens at
  // the wizard parent via useComposeDraft.
  const watched = form.watch();
  useEffect(() => {
    onChange({
      contractType: watched.contractType,
      language: watched.language as ComposeWizardStep1Type["language"],
      ourPartyName:
        typeof watched.ourPartyName === "string" && watched.ourPartyName.trim() === ""
          ? null
          : (watched.ourPartyName ?? null),
      counterpartyName:
        typeof watched.counterpartyName === "string" && watched.counterpartyName.trim() === ""
          ? null
          : (watched.counterpartyName ?? null),
      templateId: typeof watched.templateId === "number" ? watched.templateId : null,
    });
    // onChange is stable from the parent (useCallback) — depending on
    // serialised values is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watched.contractType,
    watched.language,
    watched.ourPartyName,
    watched.counterpartyName,
    watched.templateId,
  ]);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <header>
          <h2 className="text-base font-semibold text-ink">
            {t("contracts.compose.steps.step1.title")}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {t("contracts.compose.steps.step1.subtitle")}
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* contractType — required */}
          <div>
            <label
              htmlFor="compose-contractType"
              className="block text-xs font-medium text-ink-muted"
            >
              {t("contracts.fields.contractType")}
              <span className="ms-1 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <Input
              id="compose-contractType"
              type="text"
              {...form.register("contractType")}
              disabled={disabled}
              maxLength={100}
              autoComplete="off"
              aria-invalid={!!form.formState.errors.contractType}
              className="mt-1"
            />
            {form.formState.errors.contractType?.message && (
              <p className="mt-1 text-[11px] text-destructive">
                {t(form.formState.errors.contractType.message as string)}
              </p>
            )}
          </div>

          {/* language — required */}
          <div>
            <label htmlFor="compose-language" className="block text-xs font-medium text-ink-muted">
              {t("contracts.fields.language")}
              <span className="ms-1 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="compose-language"
              {...form.register("language")}
              disabled={disabled}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {CONTRACT_LANGUAGE_VALUES.map((lang) => (
                <option key={lang} value={lang}>
                  {t(`contracts.languageOptions.${lang}`, { defaultValue: lang })}
                </option>
              ))}
            </select>
          </div>

          {/* ourPartyName — free text, TODO[parties-module] */}
          <div>
            <label
              htmlFor="compose-ourPartyName"
              className="block text-xs font-medium text-ink-muted"
            >
              {t("contracts.compose.fields.ourPartyName")}
            </label>
            <Input
              id="compose-ourPartyName"
              type="text"
              {...form.register("ourPartyName")}
              disabled={disabled}
              maxLength={255}
              autoComplete="off"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-ink-subtle">
              {t("contracts.compose.fields.partyDeferredHelp")}
            </p>
          </div>

          {/* counterpartyName — free text, TODO[parties-module] */}
          <div>
            <label
              htmlFor="compose-counterpartyName"
              className="block text-xs font-medium text-ink-muted"
            >
              {t("contracts.compose.fields.counterpartyName")}
            </label>
            <Input
              id="compose-counterpartyName"
              type="text"
              {...form.register("counterpartyName")}
              disabled={disabled}
              maxLength={255}
              autoComplete="off"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-ink-subtle">
              {t("contracts.compose.fields.partyDeferredHelp")}
            </p>
          </div>
        </div>

        {/* templateId — disabled picker */}
        <div>
          <label htmlFor="compose-templateId" className="block text-xs font-medium text-ink-muted">
            {t("contracts.compose.fields.template")}
          </label>
          <select
            id="compose-templateId"
            disabled
            aria-disabled="true"
            className={cn(
              "mt-1 h-9 w-full rounded-md border border-input bg-surface px-3 py-1 text-sm shadow-sm",
              "cursor-not-allowed opacity-50",
            )}
          >
            <option value="">{t("contracts.compose.fields.templateEmpty")}</option>
          </select>
          <p className="mt-1 text-[11px] text-ink-subtle">
            {t("contracts.compose.fields.templateDeferredHelp")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default Step1Type;
