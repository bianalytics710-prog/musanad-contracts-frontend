/**
 * Step1Type — Compose Wizard Step 1 (Setup).
 *
 * D22+D23+D24 (Dana Drafter audit fix 2026-06-01):
 *   - contractType: was a free-text input; now a <select> over the same 11
 *     enum values the contracts-list filter uses, so the resulting contract
 *     matches downstream filter buckets without normalization drift.
 *   - ourPartyName + counterpartyName: free-text inputs paired with a
 *     <datalist> autocomplete populated by /api/v1/parties — the typed
 *     value still goes through (the BE accepts a name string) but the
 *     drafter now sees real party names while typing and can pick one
 *     exactly. Drops the "Free text — full party records arrive with the
 *     Parties module" placeholder copy (the module shipped long ago).
 *   - templateId: was an empty disabled <select> with "No templates
 *     available" + "Templates arrive with the Templates module" copy.
 *     Now wired to templatesService.list() with the same 8 templates the
 *     /app/templates page renders. Selection here pre-fills downstream
 *     steps via the wizard parent.
 *
 * Step advance is controlled by the parent ComposeWizard via the form's
 * isValid signal — this component owns ONLY the Step 1 fields, not the
 * navigation chrome.
 */
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CONTRACT_LANGUAGE_VALUES } from "@/types/entities/contract.types";
import { templatesService, partiesService } from "@/services/api/m_parity.service";
import { composeStep1Schema, type ComposeStep1FormData } from "../compose-wizard-schemas";
import type { ComposeWizardStep1Type } from "@/types/entities/payment-schedule.types";

// D24 — contract type enum mirrors the values surfaced in the contracts
// list filter (/app/contracts) so a contract drafted here is filterable
// downstream with no normalization.
const CONTRACT_TYPE_OPTIONS = [
  { value: "services",       labelKey: "contractType.services",       fallback: "Services" },
  { value: "epc",            labelKey: "contractType.epc",            fallback: "EPC" },
  { value: "gas_spa",        labelKey: "contractType.gas_spa",        fallback: "Gas SPA" },
  { value: "concession",     labelKey: "contractType.concession",     fallback: "Concession" },
  { value: "employment",     labelKey: "contractType.employment",     fallback: "Employment" },
  { value: "consultancy",    labelKey: "contractType.consultancy",    fallback: "Consultancy" },
  { value: "advisory",       labelKey: "contractType.advisory",       fallback: "Advisory" },
  { value: "nda",            labelKey: "contractType.nda",            fallback: "NDA" },
  { value: "master_services", labelKey: "contractType.master_services", fallback: "Master Services" },
  { value: "sow",            labelKey: "contractType.sow",            fallback: "SOW" },
  { value: "supply",         labelKey: "contractType.supply",         fallback: "Supply" },
] as const;

interface Step1TypeProps {
  /** Current state from the wizard parent (read-only props pattern). */
  value: ComposeWizardStep1Type;
  /** Emit normalised data on every valid change so the parent can persist drafts. */
  onChange: (next: ComposeWizardStep1Type) => void;
  /** Lock fields when the wizard is mid-submit. */
  disabled?: boolean;
}

export function Step1Type({ value, onChange, disabled = false }: Step1TypeProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

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

  // D22 — fetch the live template catalog. Cached 5 minutes; ID is bound
  // to wizardState.templateId on selection.
  const templatesQuery = useQuery({
    queryKey: ["compose-step1-templates"],
    queryFn: () => templatesService.list({ limit: 50 }),
    staleTime: 5 * 60_000,
  });
  const templates = templatesQuery.data?.data ?? [];

  // D23 — fetch the party catalog for the <datalist> autocomplete. The
  // limit is 50 (a sample of common counterparties); the drafter can still
  // type any name. Enabled regardless of whether either party field is
  // focused — the fetch is cheap and the cache shared.
  const partiesQuery = useQuery({
    queryKey: ["compose-step1-parties"],
    queryFn: () => partiesService.list({ limit: 50 }),
    staleTime: 5 * 60_000,
  });
  const partyOptions = useMemo(() => {
    const rows = partiesQuery.data?.data ?? [];
    return rows
      .map((p) => (isAr && p.nameAr ? p.nameAr : p.nameEn))
      .filter((s): s is string => Boolean(s));
  }, [partiesQuery.data, isAr]);

  // Subscribe to RHF values and pipe them up to the parent.
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
          {/* D24 — contractType is now a select over the canonical 11 enum
              values matching the contracts-list filter. */}
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
            <select
              id="compose-contractType"
              {...form.register("contractType")}
              disabled={disabled}
              aria-invalid={!!form.formState.errors.contractType}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <option value="">
                {t("contracts.compose.fields.contractTypeChoose", {
                  defaultValue: "Choose a contract type…",
                })}
              </option>
              {CONTRACT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey, { defaultValue: opt.fallback })}
                </option>
              ))}
            </select>
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

          {/* D23 — ourPartyName paired with a <datalist> autocomplete sourced
              from /api/v1/parties. Drafter sees real party names while
              typing. Free-text fallback preserved for new counterparties. */}
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
              list="compose-parties-datalist"
              {...form.register("ourPartyName")}
              disabled={disabled}
              maxLength={255}
              autoComplete="off"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-ink-subtle">
              {t("contracts.compose.fields.partyHelp", {
                defaultValue: "Pick from the suggested list — or type a new party name.",
              })}
            </p>
          </div>

          {/* D23 — counterpartyName: same datalist treatment. */}
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
              list="compose-parties-datalist"
              {...form.register("counterpartyName")}
              disabled={disabled}
              maxLength={255}
              autoComplete="off"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-ink-subtle">
              {t("contracts.compose.fields.partyHelp", {
                defaultValue: "Pick from the suggested list — or type a new party name.",
              })}
            </p>
          </div>
          {/* Datalist source — shared by both party fields. */}
          <datalist id="compose-parties-datalist">
            {partyOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        {/* D22 — templateId is now a real select wired to templatesService.
            The "Templates arrive with the Templates module" placeholder is
            gone; the contract drafter can pick from the live catalog. */}
        <div>
          <label htmlFor="compose-templateId" className="block text-xs font-medium text-ink-muted">
            {t("contracts.compose.fields.template")}
          </label>
          <select
            id="compose-templateId"
            {...form.register("templateId", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
            disabled={disabled || templatesQuery.isLoading}
            className={cn(
              "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <option value="">
              {t("contracts.compose.fields.templateNone", {
                defaultValue: "Start from a blank draft (no template)",
              })}
            </option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {isAr && tpl.nameAr ? tpl.nameAr : tpl.nameEn}
              </option>
            ))}
          </select>
          {templatesQuery.isLoading && (
            <p className="mt-1 text-[11px] text-ink-subtle">
              {t("contracts.compose.fields.templateLoading", { defaultValue: "Loading templates…" })}
            </p>
          )}
          {templatesQuery.isError && (
            <p className="mt-1 text-[11px] text-destructive">
              {t("contracts.compose.fields.templateError", {
                defaultValue: "Could not load templates — continue from a blank draft.",
              })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default Step1Type;
