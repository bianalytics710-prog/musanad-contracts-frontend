/**
 * Step2Parties — Compose Wizard Step 2 (Key Terms + payment-schedule sub-table).
 *
 * AC-S1-03:
 *   - titleEn (required), titleAr (optional)
 *   - valueAed (optional, >=0), currency (default 'AED')
 *   - startDate, endDate, expiryNoticeDays (default 30)
 *   - emirate, governingLaw, jurisdictionCourt
 *   - parentContractId (optional)
 *   - payment-schedule sub-table — Add Row / Remove Row
 *
 * NB: HijriDatePicker preservation (Lovable AC-S6-03) — M1b ships standard
 * <input type="date"> for both Gregorian + Hijri parity per Q1 deferred
 * picker decision; the dedicated picker lands with the I18n / Calendar
 * module in a later release.
 *
 * AC-S3-09: max 100 milestone rows. The Add Row button disables when the
 * array is at 100. AC-S3-05 / AC-S3-06: row-level validation lives in
 * paymentScheduleRowSchema (compose-wizard-schemas.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, Plus, Loader2, Languages } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  GOVERNING_LAW_VALUES,
  RELATIONSHIP_TYPE_VALUES,
  type GoverningLaw,
  type RelationshipType,
} from "@/types/entities/contract.types";
import { contractsService } from "@/services/api/contracts.service";
import { aiService } from "@/services/api/ai.service";

// D25 — UAE emirates enum mirrors the Parties page filter values + Parties
// form so any contract recorded here lines up with the rest of the app.
const EMIRATE_OPTIONS = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
] as const;

// 2026-06-04 — placeholder-specific enum dropdowns. When a template
// placeholder key matches one of these, Step 2 renders a <select> with the
// listed values instead of a free-text input. Values are stable strings the
// BE accepts as-is (no canonicalisation needed at submit).
const ARBITRATION_SEAT_OPTIONS = [
  "DIFC",
  "ADGM",
  "DIAC (Onshore Dubai)",
  "Onshore UAE",
  "London (LCIA)",
  "Paris (ICC)",
  "Singapore (SIAC)",
] as const;

const PLACEHOLDER_DROPDOWNS: Record<string, readonly string[]> = {
  emirate: EMIRATE_OPTIONS,
  governing_emirate: EMIRATE_OPTIONS,
  arbitration_seat: ARBITRATION_SEAT_OPTIONS,
};
import {
  PAYMENT_SCHEDULE_RECURRENCE_VALUES,
  PAYMENT_SCHEDULE_STATUS_VALUES,
  type PaymentScheduleStatus,
  type PaymentScheduleRecurrence,
} from "@/types/entities/payment-schedule.types";
import { composeStep2Schema, type ComposeStep2FormData } from "../compose-wizard-schemas";
import type {
  ComposeWizardStep2Parties,
  PaymentScheduleCreateDto,
} from "@/types/entities/payment-schedule.types";
import type { TemplatePlaceholder } from "@/services/api/m_parity.service";
import { Sparkles } from "lucide-react";

/** Max payment-schedule rows per AC-S3-09. */
const MAX_PAYMENT_ROWS = 100;

/** Default seed for a new milestone row (Add Row button). */
function emptyRow(): PaymentScheduleCreateDto {
  return {
    milestoneLabelEn: "",
    milestoneLabelAr: null,
    milestoneNameEn: null,
    milestoneNameAr: null,
    amountAed: 0,
    dueDate: null,
    paidAt: null,
    status: "pending" as PaymentScheduleStatus,
    recurrence: null,
    invoiceRef: null,
  };
}

interface Step2PartiesProps {
  value: ComposeWizardStep2Parties;
  onChange: (next: ComposeWizardStep2Parties) => void;
  disabled?: boolean;
  /**
   * Compose-revamp 2026-06-03 — the placeholder catalog of the currently
   * selected template (empty array when no template / blank draft). When
   * provided, each entry is rendered as a typed input above the head fields;
   * required entries gate "Next" via the parent's validity calc.
   */
  templatePlaceholders?: TemplatePlaceholder[];
  /**
   * Compose-revamp v2 2026-06-03 — Step 1 party names. When the template's
   * placeholder catalog includes `kind='party'` entries, the first one is
   * auto-filled with `ourPartyName` and the second with `counterpartyName`
   * (drafter can still override). Saves the drafter from typing the same
   * names twice.
   */
  ourPartyName?: string | null;
  counterpartyName?: string | null;
  /**
   * Step 1's chosen contract language. Drives the AR-title auto-translation
   * on EN-title blur — only fires when the contract is `bilingual` or `ar`
   * (no point translating for an EN-only contract).
   */
  contractLanguage?: "en" | "ar" | "bilingual";
  /**
   * Step 1's chosen contract type. Used to suppress the Value + Currency
   * inputs for contract types that have no meaningful monetary value
   * (NDAs are the canonical case). Optional — when absent, all fields
   * render as before.
   */
  contractType?: string | null;
}

export function Step2Parties({
  value,
  onChange,
  disabled = false,
  templatePlaceholders = [],
  ourPartyName = null,
  counterpartyName = null,
  contractLanguage = "en",
  contractType = null,
}: Step2PartiesProps) {
  // Demo-gap fix 2026-06-08 — NDAs are zero-monetary instruments; the
  // Value + Currency inputs read as noise to drafters and customers
  // wondering why an NDA needs an AED figure. Suppress both for nda type.
  const suppressValueAndCurrency = contractType === "nda";
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  // Whether AR auto-translation is in play — only when the contract needs
  // Arabic (bilingual + ar both require it; pure-en contracts skip the call).
  const wantsArTranslation =
    contractLanguage === "bilingual" || contractLanguage === "ar";

  // Placeholder input state — keyed by placeholder.key. Initial value
  // mirrors what was previously saved in step2.placeholderValues so a
  // mid-flow reload preserves work.
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>(
    value.placeholderValues ?? {},
  );

  // Compose-revamp v2 2026-06-03 — when a template placeholder already
  // captures a head-field's value, hide the duplicate input below to keep
  // the form tight. The map below routes placeholder keys to the matching
  // step2 field name; add new pairs here as templates grow.
  const placeholderKeys = new Set(templatePlaceholders.map((p) => p.key));
  const suppressStartDate =
    placeholderKeys.has("effective_date") || placeholderKeys.has("start_date");
  const suppressEndDate = placeholderKeys.has("end_date");
  const suppressEmirate =
    placeholderKeys.has("emirate") || placeholderKeys.has("governing_emirate");
  const suppressJurisdiction =
    placeholderKeys.has("jurisdiction_court") || placeholderKeys.has("arbitration_seat");
  const suppressGoverningLaw = placeholderKeys.has("governing_law");

  const handlePlaceholderChange = (key: string, next: string) => {
    setPlaceholderValues((prev) => ({ ...prev, [key]: next }));
  };

  // Compose-revamp v2 2026-06-03 — auto-fill party-kind placeholders from
  // Step 1. First `kind='party'` entry gets ourPartyName, second gets
  // counterpartyName. We only fill when the value is still empty so we don't
  // clobber a drafter override; re-runs only when the Step 1 names change.
  useEffect(() => {
    const partyKeys = templatePlaceholders.filter((p) => p.kind === "party").map((p) => p.key);
    if (partyKeys.length === 0) return;
    setPlaceholderValues((prev) => {
      const next = { ...prev };
      let changed = false;
      const candidates: Array<{ key: string; from: string | null }> = [
        { key: partyKeys[0] ?? "", from: ourPartyName ?? null },
        { key: partyKeys[1] ?? "", from: counterpartyName ?? null },
      ];
      for (const { key, from } of candidates) {
        if (!key || !from) continue;
        if (!next[key] || next[key].trim() === "") {
          next[key] = from;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ourPartyName, counterpartyName, templatePlaceholders.map((p) => p.key).join("|")]);

  // Whenever the catalog or values change, push up to the parent so the
  // wizard's required-placeholder gate can re-evaluate and persist on draft.
  // We avoid clobbering existing keys when the catalog shrinks (e.g.
  // drafter switched templates) — that's handled upstream when step1.templateId
  // changes (parent resets placeholderValues if the catalog is empty).

  const form = useForm<ComposeStep2FormData>({
    resolver: zodResolver(composeStep2Schema) as never,
    mode: "onBlur",
    defaultValues: {
      titleEn: value.titleEn ?? "",
      titleAr: value.titleAr ?? null,
      valueAed: value.valueAed ?? null,
      currency: value.currency ?? "AED",
      startDate: value.startDate ?? null,
      endDate: value.endDate ?? null,
      expiryNoticeDays: value.expiryNoticeDays ?? 30,
      emirate: value.emirate ?? null,
      governingLaw: (value.governingLaw ?? null) as ComposeStep2FormData["governingLaw"],
      jurisdictionCourt: value.jurisdictionCourt ?? null,
      parentContractId: value.parentContractId ?? null,
      relationshipType: (value.relationshipType ??
        null) as ComposeStep2FormData["relationshipType"],
      paymentSchedule: value.paymentSchedule ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "paymentSchedule",
  });

  // ─── AR title auto-translate (only when bilingual / AR) ──────────────
  // 1. On EN-title blur with AR empty + bilingual contract → call translate.
  // 2. Track the last EN value we translated for, so re-blurring the same
  //    value doesn't re-fire (cache).
  // 3. If the user manually edits AR, lock it (manualArEdited = true) so
  //    auto-translate won't overwrite their work.
  const translateMutation = useMutation({
    mutationFn: (text: string) =>
      aiService.translateTitle({ text, source: "en", target: "ar" }),
  });
  const lastTranslatedEn = useRef<string | null>(null);
  const [manualArEdited, setManualArEdited] = useState<boolean>(
    () => (value.titleAr ?? "").trim().length > 0,
  );
  const [arHelperVisible, setArHelperVisible] = useState<boolean>(false);

  const tryAutoTranslate = async (opts: { force?: boolean } = {}) => {
    if (!wantsArTranslation) return;
    const en = (form.getValues("titleEn") ?? "").trim();
    if (en.length === 0) return;
    const ar = (form.getValues("titleAr") ?? "")?.trim() ?? "";
    if (!opts.force) {
      if (ar.length > 0) return; // never overwrite existing AR.
      if (manualArEdited) return; // never re-translate after manual edit.
      if (lastTranslatedEn.current === en) return; // same EN — skip.
    }
    lastTranslatedEn.current = en;
    try {
      const result = await translateMutation.mutateAsync(en);
      const translated = (result.translated ?? "").trim();
      if (translated.length > 0) {
        form.setValue("titleAr", translated, {
          shouldDirty: true,
          shouldValidate: false,
        });
        setManualArEdited(false);
        setArHelperVisible(true);
        // Auto-fade the helper after 6s so the form stays clean.
        setTimeout(() => setArHelperVisible(false), 6000);
      }
    } catch {
      // Soft failure — leave AR blank for manual entry.
    }
  };

  const watched = form.watch();
  // Stable dep — JSON of the schedule array, computed once per render. The
  // useEffect dep array can't contain expressions (lint warns), so extract.
  const watchedScheduleJson = JSON.stringify(watched.paymentSchedule);
  useEffect(() => {
    onChange({
      titleEn: watched.titleEn,
      titleAr:
        typeof watched.titleAr === "string" && watched.titleAr.trim() === ""
          ? null
          : (watched.titleAr ?? null),
      valueAed: (() => {
        // valueAed is registered with valueAsNumber, so RHF normally hands
        // back a number. Defensively coerce string-of-digits so Playwright
        // and other non-keyboard input paths also pipe through.
        const raw: unknown = watched.valueAed;
        if (typeof raw === "number" && Number.isFinite(raw)) return raw;
        if (typeof raw === "string" && raw.trim() !== "") {
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        }
        return null;
      })(),
      currency:
        typeof watched.currency === "string" && watched.currency.trim() !== ""
          ? watched.currency
          : "AED",
      startDate:
        typeof watched.startDate === "string" && watched.startDate.trim() === ""
          ? null
          : (watched.startDate ?? null),
      endDate:
        typeof watched.endDate === "string" && watched.endDate.trim() === ""
          ? null
          : (watched.endDate ?? null),
      expiryNoticeDays:
        typeof watched.expiryNoticeDays === "number" ? watched.expiryNoticeDays : 30,
      emirate:
        typeof watched.emirate === "string" && watched.emirate.trim() === ""
          ? null
          : (watched.emirate ?? null),
      governingLaw: (watched.governingLaw as GoverningLaw | null) ?? null,
      jurisdictionCourt:
        typeof watched.jurisdictionCourt === "string" && watched.jurisdictionCourt.trim() === ""
          ? null
          : (watched.jurisdictionCourt ?? null),
      parentContractId:
        typeof watched.parentContractId === "number" ? watched.parentContractId : null,
      relationshipType: (watched.relationshipType as RelationshipType | null) ?? null,
      paymentSchedule: (watched.paymentSchedule ?? []) as PaymentScheduleCreateDto[],
      placeholderValues,
    });
    // Re-emit whenever any tracked field changes. Using JSON-stringified
    // paymentSchedule guards against array-identity churn from RHF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watched.titleEn,
    watched.titleAr,
    watched.valueAed,
    watched.currency,
    watched.startDate,
    watched.endDate,
    watched.expiryNoticeDays,
    watched.emirate,
    watched.governingLaw,
    watched.jurisdictionCourt,
    watched.parentContractId,
    watched.relationshipType,
    watchedScheduleJson,
    placeholderValues,
  ]);

  const addDisabled = disabled || fields.length >= MAX_PAYMENT_ROWS;

  return (
    <div className="space-y-4">
      {/* Template-driven required placeholders (Compose-revamp 2026-06-03). */}
      {templatePlaceholders.length > 0 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <header className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {t("contracts.compose.steps.step2.placeholdersKicker", {
                    defaultValue: "Required by template",
                  })}
                </p>
                <h3 className="mt-0.5 text-base font-semibold text-ink">
                  {t("contracts.compose.steps.step2.placeholdersTitle", {
                    defaultValue: "Fill the template's placeholders",
                  })}
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {t("contracts.compose.steps.step2.placeholdersSubtitle", {
                    defaultValue:
                      "These tokens appear in the contract body — fill them now and you'll see them replaced inline in Step 3.",
                  })}
                </p>
              </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-2">
              {templatePlaceholders.map((ph) => {
                const v = placeholderValues[ph.key] ?? "";
                const empty = ph.required && v.trim() === "";
                const label = (isAr && ph.labelAr) || ph.labelEn;
                const dropdownOptions = PLACEHOLDER_DROPDOWNS[ph.key];
                const inputType =
                  ph.kind === "date"
                    ? "date"
                    : ph.kind === "currency" || ph.kind === "number"
                    ? "number"
                    : "text";
                return (
                  <div key={ph.key}>
                    <label
                      htmlFor={`ph-${ph.key}`}
                      className="block text-xs font-medium text-ink-muted"
                    >
                      {label}
                      {ph.required && (
                        <span className="ms-1 text-destructive" aria-hidden="true">
                          *
                        </span>
                      )}
                    </label>
                    {dropdownOptions ? (
                      <select
                        id={`ph-${ph.key}`}
                        value={v}
                        onChange={(e) => handlePlaceholderChange(ph.key, e.target.value)}
                        disabled={disabled}
                        aria-invalid={empty}
                        className={cn(
                          "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          empty && "border-destructive/40",
                        )}
                      >
                        <option value="">
                          {t("contracts.fields.notSet", { defaultValue: "Select…" })}
                        </option>
                        {dropdownOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={`ph-${ph.key}`}
                        type={inputType}
                        value={v}
                        onChange={(e) => handlePlaceholderChange(ph.key, e.target.value)}
                        disabled={disabled}
                        aria-invalid={empty}
                        autoComplete="off"
                        className={cn("mt-1", empty && "border-destructive/40")}
                      />
                    )}
                    {empty && (
                      <p className="mt-1 text-[11px] text-destructive">
                        {t("contracts.compose.steps.step2.placeholderRequired", {
                          defaultValue: "Required to proceed.",
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Head fields */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <header>
            <h2 className="text-base font-semibold text-ink">
              {t("contracts.compose.steps.step2.title")}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {t("contracts.compose.steps.step2.subtitle")}
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="compose-titleEn" className="block text-xs font-medium text-ink-muted">
                {t("contracts.fields.titleEn")}
                <span className="ms-1 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <Input
                id="compose-titleEn"
                type="text"
                {...form.register("titleEn", {
                  onBlur: () => {
                    void tryAutoTranslate();
                  },
                })}
                disabled={disabled}
                maxLength={500}
                aria-invalid={!!form.formState.errors.titleEn}
                className="mt-1"
              />
              {form.formState.errors.titleEn?.message && (
                <p className="mt-1 text-[11px] text-destructive">
                  {t(form.formState.errors.titleEn.message as string)}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="compose-titleAr" className="block text-xs font-medium text-ink-muted">
                  {t("contracts.fields.titleAr")}
                </label>
                {wantsArTranslation && (
                  <button
                    type="button"
                    onClick={() => void tryAutoTranslate({ force: true })}
                    disabled={
                      disabled ||
                      translateMutation.isPending ||
                      (form.getValues("titleEn") ?? "").trim().length === 0
                    }
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-gold hover:underline disabled:opacity-40"
                  >
                    {translateMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Languages className="h-3 w-3" />
                    )}
                    {t("contracts.compose.translateFromEn", {
                      defaultValue: "Translate from EN",
                    })}
                  </button>
                )}
              </div>
              <Input
                id="compose-titleAr"
                type="text"
                dir="rtl"
                {...form.register("titleAr", {
                  onChange: () => {
                    // Drafter touched the AR field manually — lock it so the
                    // next EN blur doesn't overwrite their typing. Auto-fill
                    // clears this lock so the helper still renders.
                    if (!translateMutation.isPending) {
                      setManualArEdited(true);
                      setArHelperVisible(false);
                    }
                  },
                })}
                disabled={disabled || translateMutation.isPending}
                maxLength={500}
                className={cn(
                  "mt-1 transition-opacity",
                  translateMutation.isPending && "opacity-60",
                )}
                placeholder={
                  translateMutation.isPending
                    ? t("contracts.compose.translating", {
                        defaultValue: "Translating…",
                      })
                    : undefined
                }
              />
              {arHelperVisible && !manualArEdited && (
                <p className="mt-1 text-[11px] text-sage-ink" role="status">
                  {t("contracts.compose.arAutoTranslated", {
                    defaultValue: "Auto-translated from English — edit if needed.",
                  })}
                </p>
              )}
            </div>

            {!suppressValueAndCurrency && (
            <div>
              <label
                htmlFor="compose-valueAed"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.valueAed")}
              </label>
              <Input
                id="compose-valueAed"
                type="number"
                step="0.01"
                min={0}
                {...form.register("valueAed", { valueAsNumber: true })}
                disabled={disabled}
                aria-invalid={!!form.formState.errors.valueAed}
                className="mt-1"
              />
              {form.formState.errors.valueAed?.message && (
                <p className="mt-1 text-[11px] text-destructive">
                  {t(form.formState.errors.valueAed.message as string)}
                </p>
              )}
            </div>
            )}

            {/* D26 — currency is now a <select> over ISO-4217 codes
                relevant to UAE contracting. Was a free-text input that
                accepted any 3-character string. */}
            {!suppressValueAndCurrency && (
            <div>
              <label
                htmlFor="compose-currency"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.currency")}
              </label>
              <select
                id="compose-currency"
                {...form.register("currency")}
                disabled={disabled}
                className={cn(
                  "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {[
                  "AED",
                  "USD",
                  "EUR",
                  "GBP",
                  "SAR",
                  "QAR",
                  "KWD",
                  "BHD",
                  "OMR",
                ].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            )}

            {!suppressStartDate && (
              <div>
                <label
                  htmlFor="compose-startDate"
                  className="block text-xs font-medium text-ink-muted"
                >
                  {t("contracts.fields.startDate")}
                </label>
                <Input
                  id="compose-startDate"
                  type="date"
                  {...form.register("startDate")}
                  disabled={disabled}
                  className="mt-1"
                />
              </div>
            )}

            {!suppressEndDate && (
              <div>
                <label htmlFor="compose-endDate" className="block text-xs font-medium text-ink-muted">
                  {t("contracts.fields.endDate")}
                </label>
                <Input
                  id="compose-endDate"
                  type="date"
                  {...form.register("endDate")}
                  disabled={disabled}
                  aria-invalid={!!form.formState.errors.endDate}
                  className="mt-1"
                />
                {form.formState.errors.endDate?.message && (
                  <p className="mt-1 text-[11px] text-destructive">
                    {t(form.formState.errors.endDate.message as string)}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="compose-expiryNoticeDays"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.expiryNoticeDays")}
              </label>
              <Input
                id="compose-expiryNoticeDays"
                type="number"
                min={0}
                {...form.register("expiryNoticeDays")}
                disabled={disabled}
                className="mt-1"
              />
            </div>

            {/* D25 — emirate is now a select over the 7 UAE emirates,
                matching the Parties page filter. Free-text was letting
                "dubai" / "Dubai " / "Duabi" all into the database.
                Compose-revamp v2: suppressed when template captures emirate. */}
            {!suppressEmirate && (
              <div>
                <label htmlFor="compose-emirate" className="block text-xs font-medium text-ink-muted">
                  {t("contracts.fields.emirate")}
                </label>
                <select
                  id="compose-emirate"
                  {...form.register("emirate")}
                  disabled={disabled}
                  className={cn(
                    "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <option value="">{t("contracts.fields.notSet")}</option>
                  {EMIRATE_OPTIONS.map((e) => (
                    <option key={e} value={e}>
                      {t(`contracts.emirateOptions.${e.replace(/\s+/g, "_").toLowerCase()}`, {
                        defaultValue: e,
                      })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!suppressGoverningLaw && (
              <div>
                <label
                  htmlFor="compose-governingLaw"
                  className="block text-xs font-medium text-ink-muted"
                >
                  {t("contracts.fields.governingLaw")}
                </label>
                <select
                  id="compose-governingLaw"
                  {...form.register("governingLaw")}
                  disabled={disabled}
                  className={cn(
                    "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <option value="">{t("contracts.fields.notSet")}</option>
                  {GOVERNING_LAW_VALUES.map((g) => (
                    <option key={g} value={g}>
                      {t(`contracts.governingLawOptions.${g}`, { defaultValue: g })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!suppressJurisdiction && (
              <div>
                <label
                  htmlFor="compose-jurisdictionCourt"
                  className="block text-xs font-medium text-ink-muted"
                >
                  {t("contracts.fields.jurisdictionCourt")}
                </label>
                <Input
                  id="compose-jurisdictionCourt"
                  type="text"
                  {...form.register("jurisdictionCourt")}
                  disabled={disabled}
                  maxLength={255}
                  className="mt-1"
                />
              </div>
            )}

            {/* D27 — parentContractId was a numeric ID input that required
                the drafter to know the DB primary key of the parent contract.
                Now a search input bound to a <datalist> of contract numbers
                from /api/v1/contracts; selecting a number resolves the id
                and writes it into parentContractId behind the scenes. */}
            <ParentContractSearch
              currentId={watched.parentContractId ?? null}
              disabled={disabled}
              onResolve={(id) => form.setValue("parentContractId", id as never)}
              labelKey="contracts.fields.parentContractId"
              helpKey="contracts.compose.fields.parentContractHelp"
            />
            <input type="hidden" {...form.register("parentContractId")} />

            <div>
              <label
                htmlFor="compose-relationshipType"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.fields.relationshipType")}
              </label>
              <select
                id="compose-relationshipType"
                {...form.register("relationshipType")}
                disabled={disabled}
                className={cn(
                  "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <option value="">{t("contracts.fields.notSet")}</option>
                {RELATIONSHIP_TYPE_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {t(`contracts.relationshipTypeOptions.${r}`, { defaultValue: r })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment schedule sub-table */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink">
                {t("contracts.paymentSchedule.title")}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">
                {t("contracts.paymentSchedule.subtitle")}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append(emptyRow() as never)}
              disabled={addDisabled}
              aria-label={t("contracts.paymentSchedule.addRow")}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("contracts.paymentSchedule.addRow")}
            </Button>
          </header>

          {fields.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-ink-muted">
              {t("contracts.paymentSchedule.empty")}
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((row, index) => {
                const rowErrors = form.formState.errors.paymentSchedule?.[index];
                return (
                  <div key={row.id} className="rounded-md border border-border bg-surface/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink-muted">
                        {t("contracts.paymentSchedule.rowLabel", { n: index + 1 })}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(index)}
                        disabled={disabled}
                        aria-label={t("contracts.paymentSchedule.removeRow", { n: index + 1 })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`row-${index}-labelEn`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.milestoneLabelEn")}
                          <span className="ms-1 text-destructive" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <Input
                          id={`row-${index}-labelEn`}
                          type="text"
                          {...form.register(`paymentSchedule.${index}.milestoneLabelEn` as const)}
                          disabled={disabled}
                          maxLength={255}
                          aria-invalid={!!rowErrors?.milestoneLabelEn}
                          className="mt-1"
                        />
                        {rowErrors?.milestoneLabelEn?.message && (
                          <p className="mt-1 text-[10px] text-destructive">
                            {t(rowErrors.milestoneLabelEn.message as string)}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-labelAr`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.milestoneLabelAr")}
                        </label>
                        <Input
                          id={`row-${index}-labelAr`}
                          type="text"
                          dir="rtl"
                          {...form.register(`paymentSchedule.${index}.milestoneLabelAr` as const)}
                          disabled={disabled}
                          maxLength={255}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-amount`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.amountAed")}
                          <span className="ms-1 text-destructive" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <Input
                          id={`row-${index}-amount`}
                          type="number"
                          step="0.01"
                          min={0}
                          {...form.register(`paymentSchedule.${index}.amountAed` as const)}
                          disabled={disabled}
                          aria-invalid={!!rowErrors?.amountAed}
                          className="mt-1"
                        />
                        {rowErrors?.amountAed?.message && (
                          <p className="mt-1 text-[10px] text-destructive">
                            {t(rowErrors.amountAed.message as string)}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-due`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.dueDate")}
                        </label>
                        <Input
                          id={`row-${index}-due`}
                          type="date"
                          {...form.register(`paymentSchedule.${index}.dueDate` as const)}
                          disabled={disabled}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-status`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.status")}
                        </label>
                        <select
                          id={`row-${index}-status`}
                          {...form.register(`paymentSchedule.${index}.status` as const)}
                          disabled={disabled}
                          className={cn(
                            "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                        >
                          {PAYMENT_SCHEDULE_STATUS_VALUES.map((s) => (
                            <option key={s} value={s}>
                              {t(`contracts.paymentSchedule.statusOptions.${s}`, {
                                defaultValue: s,
                              })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`row-${index}-recurrence`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.recurrence")}
                        </label>
                        <select
                          id={`row-${index}-recurrence`}
                          {...form.register(`paymentSchedule.${index}.recurrence` as const)}
                          disabled={disabled}
                          className={cn(
                            "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                        >
                          <option value="">{t("contracts.fields.notSet")}</option>
                          {PAYMENT_SCHEDULE_RECURRENCE_VALUES.map((r) => (
                            <option key={r} value={r}>
                              {t(`contracts.paymentSchedule.recurrenceOptions.${r}`, {
                                defaultValue: r,
                              })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`row-${index}-invoice`}
                          className="block text-[11px] font-medium text-ink-muted"
                        >
                          {t("contracts.paymentSchedule.fields.invoiceRef")}
                        </label>
                        <Input
                          id={`row-${index}-invoice`}
                          type="text"
                          {...form.register(`paymentSchedule.${index}.invoiceRef` as const)}
                          disabled={disabled}
                          maxLength={100}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {fields.length >= MAX_PAYMENT_ROWS && (
            <p className="text-[11px] text-amber-ink">
              {t("contracts.paymentSchedule.errors.tooManyRows")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Re-export the unused recurrence type so consumers can import alongside
// the component if needed; the wizard parent doesn't need it directly.
export type { PaymentScheduleRecurrence };

/**
 * D27 — drop-in search for the parent-contract picker.
 *
 * Renders a text input bound to a `<datalist>` of contract numbers fetched
 * via contractsService.list. As the drafter types and picks a number, we
 * resolve to the row's id and write it into parentContractId (number) on
 * the parent form. The datalist is limited to 50 most-recent contracts so
 * the dropdown stays responsive; if the drafter needs an older contract
 * they can paste its number and we still resolve.
 */
function ParentContractSearch({
  currentId,
  disabled,
  onResolve,
  labelKey,
  helpKey,
}: {
  currentId: number | null;
  disabled?: boolean;
  onResolve: (id: number | null) => void;
  labelKey: string;
  helpKey: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const listQuery = useQuery({
    queryKey: ["compose-parent-contracts"],
    queryFn: () => contractsService.list({ limit: 50 }),
    staleTime: 5 * 60_000,
  });
  const rows = listQuery.data?.data ?? [];

  // Whenever the rendered value changes, try to resolve to a contract id
  // and propagate up. If the value clears, propagate null.
  useEffect(() => {
    if (!query.trim()) {
      if (currentId !== null) onResolve(null);
      return;
    }
    const hit = rows.find(
      (r) =>
        r.contractNumber?.toLowerCase() === query.trim().toLowerCase() ||
        String(r.id) === query.trim(),
    );
    if (hit && hit.id !== currentId) onResolve(hit.id);
    // If no hit, leave currentId as-is — user might still be typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, rows.length]);

  // Seed the input with the current contractNumber on first render.
  useEffect(() => {
    if (currentId && !query && rows.length > 0) {
      const hit = rows.find((r) => r.id === currentId);
      if (hit) setQuery(hit.contractNumber ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  return (
    <div>
      <label htmlFor="compose-parentContractSearch" className="block text-xs font-medium text-ink-muted">
        {t(labelKey)}
      </label>
      <Input
        id="compose-parentContractSearch"
        type="text"
        list="compose-parent-contracts-datalist"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled || listQuery.isLoading}
        maxLength={50}
        autoComplete="off"
        placeholder={t("contracts.compose.fields.parentContractPlaceholder", {
          defaultValue: "Type or pick a contract number",
        })}
        className="mt-1"
      />
      <datalist id="compose-parent-contracts-datalist">
        {rows.map((r) => (
          <option key={r.id} value={r.contractNumber ?? ""}>
            {r.titleEn ?? ""}
          </option>
        ))}
      </datalist>
      <p className="mt-1 text-[11px] text-ink-subtle">
        {t(helpKey, {
          defaultValue:
            "Leave blank if this is a standalone contract. Pick a parent only for Amendment / Renewal / Extension / SOW under MSA.",
        })}
      </p>
    </div>
  );
}

export default Step2Parties;
