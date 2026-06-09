/**
 * Step1Type — Compose Wizard Step 1 (Template & Parties).
 *
 * Compose-revamp 2026-06-03 — replaces the old "Setup" form:
 *
 *   1. A 2-col TILE GRID of templates (top 6 by usage_count) preceded by
 *      a "Start from blank draft" tile. A "Browse all templates" button
 *      below opens a modal with the full catalog when the drafter wants
 *      something outside the top 6.
 *   2. Once a template tile is picked, contractType + language are
 *      auto-applied from the template (locked read-only chips with a
 *      "Change template" affordance to reset).
 *   3. Our party + counter party stay as datalist-backed inputs.
 *
 * Step advance is controlled by the parent ComposeWizard via the form's
 * isValid signal — this component owns ONLY the Step 1 fields, not the
 * navigation chrome.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, ListPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CONTRACT_LANGUAGE_VALUES } from "@/types/entities/contract.types";
import {
  templatesService,
  partiesService,
  type TemplateListItem,
} from "@/services/api/m_parity.service";
import { humanizeLabel } from "@/features/dashboards/components/dashboard-primitives";
import { composeStep1Schema, type ComposeStep1FormData } from "../compose-wizard-schemas";
import type { ComposeWizardStep1Type } from "@/types/entities/payment-schedule.types";

// Mirrors the contracts-list filter enum (D24) so filterable downstream.
const CONTRACT_TYPE_OPTIONS = [
  { value: "services",        labelKey: "contractType.services",        fallback: "Services" },
  { value: "epc",             labelKey: "contractType.epc",             fallback: "EPC" },
  { value: "gas_spa",         labelKey: "contractType.gas_spa",         fallback: "Gas SPA" },
  { value: "concession",      labelKey: "contractType.concession",      fallback: "Concession" },
  { value: "employment",      labelKey: "contractType.employment",      fallback: "Employment" },
  { value: "consultancy",     labelKey: "contractType.consultancy",     fallback: "Consultancy" },
  { value: "advisory",        labelKey: "contractType.advisory",        fallback: "Advisory" },
  { value: "nda",             labelKey: "contractType.nda",             fallback: "NDA" },
  { value: "master_services", labelKey: "contractType.master_services", fallback: "Master Services" },
  { value: "sow",             labelKey: "contractType.sow",             fallback: "SOW" },
  { value: "supply",          labelKey: "contractType.supply",          fallback: "Supply" },
  { value: "distribution",    labelKey: "contractType.distribution",    fallback: "Distribution" },
  { value: "lease",           labelKey: "contractType.lease",           fallback: "Lease" },
  { value: "vendor_services", labelKey: "contractType.vendor_services", fallback: "Vendor Services" },
  { value: "llc_incorporation", labelKey: "contractType.llc_incorporation", fallback: "LLC Incorporation" },
] as const;

const TOP_TILE_COUNT = 6;

interface Step1TypeProps {
  value: ComposeWizardStep1Type;
  onChange: (next: ComposeWizardStep1Type) => void;
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
      // Compose-revamp v2 — parties are required strings; empty default so
      // the Required gate fires on first render.
      ourPartyName: value.ourPartyName ?? "",
      counterpartyName: value.counterpartyName ?? "",
      templateId: value.templateId ?? null,
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["compose-step1-templates"],
    queryFn: () => templatesService.list({ limit: 50 }),
    staleTime: 5 * 60_000,
  });
  const templates = templatesQuery.data?.data ?? [];
  const topTemplates = templates.slice(0, TOP_TILE_COUNT);
  const hasMoreTemplates = templates.length > TOP_TILE_COUNT;

  const partiesQuery = useQuery({
    queryKey: ["compose-step1-parties"],
    queryFn: () => partiesService.list({ limit: 500 }),
    staleTime: 5 * 60_000,
  });
  const partyOptions = useMemo(() => {
    const rows = partiesQuery.data?.data ?? [];
    return rows
      .map((p) => (isAr && p.nameAr ? p.nameAr : p.nameEn))
      .filter((s): s is string => Boolean(s));
  }, [partiesQuery.data, isAr]);

  const resolvePartyId = useCallback(
    (name: string | null | undefined): number | null => {
      if (!name || typeof name !== "string") return null;
      const needle = name.trim().toLowerCase();
      if (!needle) return null;
      const rows = partiesQuery.data?.data ?? [];
      const hit = rows.find(
        (p) =>
          (p.nameEn && p.nameEn.trim().toLowerCase() === needle) ||
          (p.nameAr && p.nameAr.trim().toLowerCase() === needle),
      );
      return hit ? hit.id : null;
    },
    [partiesQuery.data],
  );

  const selectedTemplate: TemplateListItem | null = useMemo(() => {
    const id = form.watch("templateId");
    if (typeof id !== "number") return null;
    return templates.find((tpl) => tpl.id === id) ?? null;
  }, [form.watch("templateId"), templates]);

  const selectTemplate = (tpl: TemplateListItem | null) => {
    // Picking a template auto-fills contract type and language. Picking
    // the "Blank draft" tile clears contractType so the drafter picks it.
    if (tpl == null) {
      form.setValue("templateId", null, { shouldValidate: true, shouldDirty: true });
      form.setValue("contractType", "", { shouldValidate: true, shouldDirty: true });
      // Leave language as-is; it defaults to 'en'.
      return;
    }
    form.setValue("templateId", tpl.id, { shouldValidate: true, shouldDirty: true });
    form.setValue("contractType", tpl.contractType, { shouldValidate: true, shouldDirty: true });
    // 2026-06-09 — honor the template's bilingual language so AR-title
    // auto-translate fires on Step 2. Previously bilingual was coerced to
    // 'en', which silently disabled the EN→AR translate-on-blur feature
    // even though the template (e.g. Mutual NDA Bilingual) is explicitly
    // designed for parallel EN+AR drafting.
    form.setValue("language", tpl.language, { shouldValidate: true, shouldDirty: true });
  };

  // Subscribe to RHF values and pipe them up to the parent.
  const watched = form.watch();
  useEffect(() => {
    const ourPartyNameClean =
      typeof watched.ourPartyName === "string" && watched.ourPartyName.trim() === ""
        ? null
        : (watched.ourPartyName ?? null);
    const counterpartyNameClean =
      typeof watched.counterpartyName === "string" && watched.counterpartyName.trim() === ""
        ? null
        : (watched.counterpartyName ?? null);
    onChange({
      contractType: watched.contractType,
      language: watched.language as ComposeWizardStep1Type["language"],
      ourPartyName: ourPartyNameClean,
      ourPartyId: resolvePartyId(ourPartyNameClean),
      counterpartyName: counterpartyNameClean,
      counterpartyId: resolvePartyId(counterpartyNameClean),
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

  // Browse-all dialog state.
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseQuery, setBrowseQuery] = useState("");
  const browseList = useMemo(() => {
    if (!browseQuery.trim()) return templates;
    const q = browseQuery.trim().toLowerCase();
    return templates.filter(
      (tpl) =>
        tpl.nameEn.toLowerCase().includes(q) ||
        (tpl.nameAr ?? "").toLowerCase().includes(q) ||
        tpl.contractType.toLowerCase().includes(q),
    );
  }, [browseQuery, templates]);

  const isBlankDraft = typeof watched.templateId !== "number";

  return (
    <div className="space-y-4">
      {/* TEMPLATE & PARTIES card with tile grid */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <header>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              {t("contracts.compose.steps.step1.kicker", {
                defaultValue: "Template & parties",
              })}
            </p>
            <h2 className="mt-1 text-base font-semibold text-ink">
              {t("contracts.compose.steps.step1.title", {
                defaultValue: "Select a template",
              })}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {t("contracts.compose.steps.step1.subtitle", {
                defaultValue:
                  "Pick a template to pre-load standard clauses + placeholder prompts — or start blank.",
              })}
            </p>
          </header>

          {templatesQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-md bg-surface" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Blank draft tile — always first */}
              <TemplateTile
                isSelected={isBlankDraft}
                disabled={disabled}
                onClick={() => selectTemplate(null)}
                icon={<FileText className="h-5 w-5 text-ink-subtle" aria-hidden="true" />}
                title={t("contracts.compose.steps.step1.blankTitle", {
                  defaultValue: "Start from blank draft",
                })}
                subtitle={t("contracts.compose.steps.step1.blankSubtitle", {
                  defaultValue: "No template",
                })}
              />
              {topTemplates.map((tpl) => (
                <TemplateTile
                  key={tpl.id}
                  isSelected={watched.templateId === tpl.id}
                  disabled={disabled}
                  onClick={() => selectTemplate(tpl)}
                  icon={<FileText className="h-5 w-5 text-gold" aria-hidden="true" />}
                  title={isAr && tpl.nameAr ? tpl.nameAr : tpl.nameEn}
                  subtitle={tpl.contractType.toUpperCase()}
                />
              ))}
            </div>
          )}

          {hasMoreTemplates && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBrowseOpen(true)}
              disabled={disabled}
              className="w-full"
            >
              <ListPlus className="h-4 w-4" aria-hidden="true" />
              {t("contracts.compose.steps.step1.browseAll", {
                defaultValue: "Browse all templates",
              })}
              <span className="ms-1 font-mono text-[10px] text-ink-subtle">
                {templates.length}
              </span>
            </Button>
          )}

          {templatesQuery.isError && (
            <p className="text-[11px] text-destructive">
              {t("contracts.compose.fields.templateError", {
                defaultValue: "Could not load templates — start from a blank draft.",
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Derived contract type + language + party inputs */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <header>
            <h3 className="text-sm font-semibold text-ink">
              {t("contracts.compose.steps.step1.detailsTitle", {
                defaultValue: "Contract details",
              })}
            </h3>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Contract type — auto-filled when a template is selected. */}
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
              {selectedTemplate ? (
                <div
                  id="compose-contractType"
                  className={cn(
                    "mt-1 flex h-9 items-center gap-2 rounded-md border border-input bg-surface/60 px-3 text-sm text-ink",
                    "shadow-sm",
                  )}
                >
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink">
                    {humanizeLabel(selectedTemplate.contractType)}
                  </span>
                  <span className="text-xs text-ink-subtle">
                    {t("contracts.compose.steps.step1.autoFromTemplate", {
                      defaultValue: "auto from template",
                    })}
                  </span>
                </div>
              ) : (
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
              )}
              {form.formState.errors.contractType?.message && (
                <p className="mt-1 text-[11px] text-destructive">
                  {t(form.formState.errors.contractType.message as string)}
                </p>
              )}
            </div>

            {/* Language */}
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

            {/* Our party — required */}
            <div>
              <label
                htmlFor="compose-ourPartyName"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.compose.fields.ourPartyName")}
                <span className="ms-1 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <Input
                id="compose-ourPartyName"
                type="text"
                list="compose-parties-datalist"
                {...form.register("ourPartyName")}
                disabled={disabled}
                maxLength={255}
                autoComplete="off"
                aria-invalid={!!form.formState.errors.ourPartyName}
                className="mt-1"
              />
              {form.formState.errors.ourPartyName?.message ? (
                <p className="mt-1 text-[11px] text-destructive">
                  {t(form.formState.errors.ourPartyName.message as string)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-ink-subtle">
                  {t("contracts.compose.fields.partyHelp", {
                    defaultValue: "Pick from the suggested list — or type a new party name.",
                  })}
                </p>
              )}
            </div>

            {/* Counterparty — required */}
            <div>
              <label
                htmlFor="compose-counterpartyName"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("contracts.compose.fields.counterpartyName")}
                <span className="ms-1 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <Input
                id="compose-counterpartyName"
                type="text"
                list="compose-parties-datalist"
                {...form.register("counterpartyName")}
                disabled={disabled}
                maxLength={255}
                autoComplete="off"
                aria-invalid={!!form.formState.errors.counterpartyName}
                className="mt-1"
              />
              {form.formState.errors.counterpartyName?.message ? (
                <p className="mt-1 text-[11px] text-destructive">
                  {t(form.formState.errors.counterpartyName.message as string)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-ink-subtle">
                  {t("contracts.compose.fields.partyHelp", {
                    defaultValue: "Pick from the suggested list — or type a new party name.",
                  })}
                </p>
              )}
            </div>
            <datalist id="compose-parties-datalist">
              {partyOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </CardContent>
      </Card>

      {/* Browse-all modal */}
      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("contracts.compose.steps.step1.browseAllTitle", {
                defaultValue: "All templates",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("contracts.compose.steps.step1.browseAllSubtitle", {
                defaultValue: "Search the full template catalog.",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <Input
              type="search"
              value={browseQuery}
              onChange={(e) => setBrowseQuery(e.target.value)}
              placeholder={t("contracts.compose.steps.step1.browseSearch", {
                defaultValue: "Search by name or type…",
              })}
              className="ps-7"
              autoFocus
            />
          </div>

          <div className="grid max-h-96 gap-2 overflow-y-auto pe-1 sm:grid-cols-2">
            {browseList.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  selectTemplate(tpl);
                  setBrowseOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2 rounded-md border border-border bg-surface/40 p-2 text-start transition-colors",
                  "hover:bg-gold/10 hover:border-gold/40",
                  watched.templateId === tpl.id && "border-gold bg-gold/10",
                )}
              >
                <FileText className="mt-0.5 h-4 w-4 text-gold" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">
                    {isAr && tpl.nameAr ? tpl.nameAr : tpl.nameEn}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {tpl.contractType}
                  </p>
                </div>
              </button>
            ))}
            {browseList.length === 0 && (
              <p className="col-span-full rounded-md border border-dashed border-border p-6 text-center text-xs text-ink-muted">
                {t("contracts.compose.steps.step1.browseEmpty", {
                  defaultValue: "No templates match.",
                })}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setBrowseOpen(false)}>
              <X className="h-3.5 w-3.5" />
              {t("common.close", { defaultValue: "Close" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateTileProps {
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function TemplateTile({ isSelected, disabled, onClick, icon, title, subtitle }: TemplateTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isSelected}
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border bg-card p-3 text-start transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isSelected
          ? "border-gold bg-gold/10 ring-1 ring-gold/30"
          : "border-border hover:bg-surface/60",
      )}
    >
      {icon}
      <p className="line-clamp-2 text-sm font-medium text-ink">{title}</p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">{subtitle}</p>
    </button>
  );
}

export default Step1Type;
