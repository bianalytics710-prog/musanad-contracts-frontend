/**
 * ComposeWizard (S1) — 5-step contract composition flow.
 *
 * Steps:
 *   1. Setup        (Step1Type)        — contract type + language + party stubs
 *   2. Key Terms    (Step2Parties)     — head fields + payment-schedule sub-table
 *   3. Clauses/Body (Step3Terms)       — bodyEn + bodyAr (AI panel deferred)
 *   4. Attachments  — SKIPPED (AC-S1-01); wizard advances 3 → 5 directly.
 *   5. Review       (Step5Review)      — read-only preview before Submit
 *
 * Submit handler is FE-only orchestration (AC-S1-08, Q2):
 *   POST /api/v1/contracts → captures id → PUT /:id/payment-schedules.
 *   See useComposeSubmit.ts for the failure-mode logic.
 *
 * Persistence (AC-S1-07): on every input change, debounced 300ms, the
 * full wizard state is written to localStorage under
 * `compose-draft:{userId}:{composeDraftId}` so accidental reloads don't
 * lose work. Cleared on successful submit.
 *
 * RBAC (AC-S1-09): the route is gated by contract.draft permission. This
 * component double-checks via `selectHasPermission` and renders a 403 page
 * when the user can't access it (defense-in-depth — BE remains the truth).
 *
 * Accessibility (AC-S1-11):
 *   - Step transitions announce via aria-live + a progress indicator.
 *   - Keyboard navigation: focus moves to the new step's first focusable
 *     element on advance / back.
 *   - useFocusTrap is applied to ANY modal opened inside the wizard
 *     (currently none — the wizard renders inline; the shared utility
 *     covers PaymentScheduleEditor, ExportPdfDialog, etc.).
 *
 * T13: bodyEn + bodyAr are SENSITIVE. On unmount we deliberately scrub the
 * in-memory React state so navigation away doesn't leave residue, mirroring
 * the FE-C1 fix from M1a's ContractCreateForm. localStorage retention is
 * acknowledged in the useComposeDraft.ts header.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Send, RotateCcw, AlertTriangle, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore, selectHasPermission, selectUser } from "@/store/auth.store";
import { templatesService } from "@/services/api/m_parity.service";
import { workOrdersService, workOrderKeys } from "@/services/api/work-orders.service";
import { parseTemplateBodyBilingual } from "./template-body-parser";
import { translateApiError } from "@/lib/translate-api-error";
import { Step1Type } from "./steps/Step1Type";
import { Step2Parties } from "./steps/Step2Parties";
import { Step3Terms } from "./steps/Step3Terms";
import { Step5Review } from "./steps/Step5Review";
import { useComposeDraftState, generateComposeDraftId, clearComposeDraft } from "./useComposeDraft";
import { useComposeSubmit } from "./useComposeSubmit";
import {
  composeStep1Schema,
  composeStep2Schema,
  composeStep3Schema,
} from "./compose-wizard-schemas";
import { cn } from "@/lib/utils";
import type {
  ComposeWizardState,
  ComposeWizardStep,
  ComposeWizardStep1Type,
  ComposeWizardStep2Parties,
  ComposeWizardStep3ClausesBody,
} from "@/types/entities/payment-schedule.types";

/**
 * Step indices in display order. Step 4 is omitted because it's SKIPPED.
 * Used to compute "Step N of 4" labels and for next/back nav.
 */
const STEP_ORDER: readonly ComposeWizardStep[] = [1, 2, 3, 5] as const;

/** Initial state factory — used when no draft exists in localStorage. */
function emptyState(composeDraftId: string): ComposeWizardState {
  return {
    step1: {
      contractType: "",
      language: "en",
      ourPartyName: "",
      counterpartyName: "",
      templateId: null,
    },
    step2: {
      titleEn: "",
      titleAr: null,
      valueAed: null,
      currency: "AED",
      startDate: null,
      endDate: null,
      expiryNoticeDays: 30,
      emirate: null,
      governingLaw: null,
      jurisdictionCourt: null,
      parentContractId: null,
      relationshipType: null,
      paymentSchedule: [],
      placeholderValues: {},
    },
    step3: {
      bodyEn: null,
      bodyAr: null,
      sections: [],
      bodyLanguage: "en",
    },
    currentStep: 1,
    composeDraftId,
  };
}

interface ComposeWizardProps {
  /** Optional override for the draft id (e.g., when resuming from a URL param). */
  composeDraftId?: string;
  /** Optional template id from `?template_id=N` to seed the wizard with. */
  prefillTemplateId?: number | null;
  /** M21 — Optional work-order id from `?fromWorkOrder=N`. Wizard skips the
   *  template picker and seeds Step1/2/3 from an AI extraction of the source
   *  contract referenced by the work order. */
  fromWorkOrderId?: number | null;
}

export function ComposeWizard({
  composeDraftId,
  prefillTemplateId = null,
  fromWorkOrderId = null,
}: ComposeWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(selectUser);
  const canDraft = useAuthStore(selectHasPermission("contract.draft"));

  // Stable draft id across renders. If the consumer didn't pass one, mint
  // a fresh id ONCE per mount; URL deep-linking can later thread its own
  // value through the route param.
  const draftIdRef = useRef<string>(composeDraftId ?? generateComposeDraftId());
  const draftId = draftIdRef.current;

  const [state, setState] = useComposeDraftState(user?.id ?? null, draftId, () =>
    emptyState(draftId),
  );

  // Pre-fetch the template when ?template_id= is present so we can seed
  // step1/step3 before the wizard's first interactive render. Only fires
  // once: the prefillAppliedRef guards against re-applying after the user
  // has started editing (state.step1.templateId === prefillTemplateId).
  const wantsPrefill = typeof prefillTemplateId === "number" && Number.isInteger(prefillTemplateId);
  const { data: prefillTemplate, isLoading: prefillLoading, isError: prefillError } = useQuery({
    queryKey: ["compose-prefill-template", prefillTemplateId],
    queryFn: () => templatesService.getById(prefillTemplateId!),
    enabled: wantsPrefill,
    staleTime: 5 * 60_000,
  });

  const prefillAppliedRef = useRef(false);
  useEffect(() => {
    if (!wantsPrefill || !prefillTemplate || prefillAppliedRef.current) return;
    if (state.step1.templateId === prefillTemplate.id) {
      prefillAppliedRef.current = true;
      return;
    }
    prefillAppliedRef.current = true;
    // Just point at the prefilled template — the activeTemplate effect below
    // seeds Step 3 selectedClauses and resets placeholder values when it
    // sees a new templateId.
    setState((s) => ({
      ...s,
      step1: {
        ...s.step1,
        contractType: prefillTemplate.contractType,
        language:
          prefillTemplate.language === "bilingual"
            ? s.step1.language
            : (prefillTemplate.language as "en" | "ar"),
        templateId: prefillTemplate.id,
      },
    }));
  }, [prefillTemplate, wantsPrefill, setState, state.step1.templateId]);

  // In-wizard template selection — when the drafter picks a template (via
  // tile grid or ?template_id= deep link), fetch the full template detail
  // (placeholder catalog + body_en/ar) and seed Step 3 sections by parsing
  // the template body into preamble / clause / signature blocks.
  const activeTemplateId = state.step1.templateId ?? null;
  const { data: activeTemplate } = useQuery({
    queryKey: ["compose-active-template", activeTemplateId],
    queryFn: () => templatesService.getById(activeTemplateId!),
    enabled: activeTemplateId != null,
    staleTime: 5 * 60_000,
  });

  // Default-clause ids associated with the active template via mig 506
  // (contract_template_clause). Drives the "In template" badge in the
  // Step 3 clause library so the drafter sees which library clauses are
  // already covered by the chosen template — even though those library
  // clauses don't get auto-inserted (the template body already includes
  // equivalent text). Drafter can still scroll the library to find
  // genuinely additional clauses to insert.
  const { data: templateDefaultClauses } = useQuery({
    queryKey: ["compose-active-template-defaults", activeTemplateId],
    queryFn: () => templatesService.defaultClauses(activeTemplateId!),
    enabled: activeTemplateId != null,
    staleTime: 5 * 60_000,
  });
  const inTemplateClauseIds = useMemo(
    () => new Set((templateDefaultClauses?.data ?? []).map((d) => d.clauseId)),
    [templateDefaultClauses],
  );

  const lastSeededTemplateRef = useRef<number | null>(null);
  useEffect(() => {
    if (activeTemplateId == null) {
      // Switched back to "Start from blank" — clear any previously parsed
      // template-sourced sections so Step 3 doesn't preserve stale content.
      if (lastSeededTemplateRef.current !== null) {
        lastSeededTemplateRef.current = null;
        setState((s) => ({
          ...s,
          step2: { ...s.step2, placeholderValues: {} },
          step3: {
            ...s.step3,
            sections: (s.step3.sections ?? []).filter((sec) => sec.source !== "template"),
          },
        }));
      }
      return;
    }
    if (!activeTemplate) return;
    if (lastSeededTemplateRef.current === activeTemplateId) return;
    lastSeededTemplateRef.current = activeTemplateId;
    const parsedSections = parseTemplateBodyBilingual(
      activeTemplate.bodyEn,
      activeTemplate.bodyAr,
    );
    setState((s) => {
      // Preserve any library-sourced sections (drafter-inserted) across
      // template switches by appending them after the new template's clauses
      // but before its signature.
      const librarySections = (s.step3.sections ?? []).filter((sec) => sec.source === "library");
      const sigIdx = parsedSections.findIndex((sec) => sec.kind === "signature");
      const merged =
        sigIdx === -1
          ? [...parsedSections, ...librarySections]
          : [
              ...parsedSections.slice(0, sigIdx),
              ...librarySections,
              ...parsedSections.slice(sigIdx),
            ];
      return {
        ...s,
        step1: {
          ...s.step1,
          language:
            activeTemplate.language === "bilingual"
              ? s.step1.language
              : (activeTemplate.language as "en" | "ar"),
        },
        step2: { ...s.step2, placeholderValues: {} },
        step3: { ...s.step3, sections: merged },
      };
    });
  }, [activeTemplateId, activeTemplate, setState]);

  const { submit, retryStep2, isSubmitting, phase, error: submitError } = useComposeSubmit();

  // M21 — work-order seeding path. When fromWorkOrderId is set, fetch the
  // work order, then call extract-from-source for the AI-redacted body +
  // placeholders. The wizard skips Step 1 (template picker) and lands
  // straight on Step 2.
  const workOrderQuery = useQuery({
    queryKey: ["workOrders", "detail", fromWorkOrderId],
    queryFn: () => workOrdersService.getById(fromWorkOrderId!),
    enabled: fromWorkOrderId != null,
    staleTime: 60_000,
  });
  const sourceContractId = workOrderQuery.data?.sourceContractId ?? null;
  const extractQuery = useQuery({
    queryKey: ["workOrders", "extract", sourceContractId],
    queryFn: () => workOrdersService.extractFromSource(sourceContractId!),
    enabled: sourceContractId != null,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const wantsWorkOrderSeed = fromWorkOrderId != null;
  const workOrderSeedReady = !!extractQuery.data && !!workOrderQuery.data;

  // Build a virtual activeTemplate-like object for Step2's placeholder UI.
  const virtualTemplate = useMemo(() => {
    if (!extractQuery.data) return null;
    return {
      placeholders: extractQuery.data.placeholders.map((p) => ({
        key: p.key,
        labelEn: p.labelEn,
        labelAr: p.labelAr ?? null,
        kind: p.kind,
        required: p.required ?? false,
        defaultValue: p.defaultValue ?? null,
      })),
    };
  }, [extractQuery.data]);

  // Apply the work-order seed exactly once into wizard state.
  const workOrderSeededRef = useRef(false);
  useEffect(() => {
    if (!wantsWorkOrderSeed || !workOrderSeedReady) return;
    if (workOrderSeededRef.current) return;
    workOrderSeededRef.current = true;
    const wo = workOrderQuery.data!;
    const ex = extractQuery.data!;
    const counterpartyName = (wo.payload?.counterpartyName as string | undefined) ?? wo.counterpartyName ?? "";
    const valueAed = (wo.payload?.valueAed as number | string | null | undefined);
    const valueNum = typeof valueAed === "number" ? valueAed : valueAed != null ? Number(valueAed) || null : null;
    const parsedSections = parseTemplateBodyBilingual(ex.bodyEnRedacted, null);
    // Derive a fresh title from NEW counterparty + contract type so titleEn
    // (required) isn't silently empty when Step 1 is skipped. We deliberately
    // don't mirror the source title (drafter complained that was confusing).
    const humanType =
      ex.contractType
        ? ex.contractType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        : "Contract";
    const derivedTitle = counterpartyName
      ? `${counterpartyName} — ${humanType} (Draft)`
      : `${humanType} (Draft)`;
    // Pre-fill placeholder values: counterparty name + sane defaults from
    // the work order payload. The drafter still fills the rest in Step 2.
    const preFilledPlaceholders: Record<string, string> = {};
    for (const p of ex.placeholders) {
      if (p.kind === "party" && counterpartyName && /counter|second_party|client|customer/i.test(p.key)) {
        preFilledPlaceholders[p.key] = counterpartyName;
      }
      if (p.kind === "currency" && /value|amount|total/i.test(p.key) && valueNum != null) {
        preFilledPlaceholders[p.key] = String(valueNum);
      }
    }
    setState((s) => ({
      ...s,
      step1: {
        ...s.step1,
        contractType: ex.contractType,
        language: ex.language === "bilingual" ? s.step1.language : (ex.language as "en" | "ar"),
        // The drafter never sees Step 1 when seeded from a work order, but
        // Step 1 schema requires ourPartyName + counterpartyName. Set sensible
        // defaults from the tenant + the exec's counterparty pick.
        ourPartyName: s.step1.ourPartyName || "ADNOC",
        counterpartyName: counterpartyName || s.step1.counterpartyName,
        templateId: null,
      },
      step2: {
        ...s.step2,
        // Title derived from NEW counterparty + contract type (not source).
        // Fill-if-empty so a drafter who already typed a title isn't clobbered.
        titleEn: s.step2.titleEn && s.step2.titleEn.trim().length > 0 ? s.step2.titleEn : derivedTitle,
        valueAed: valueNum ?? s.step2.valueAed,
        placeholderValues: { ...(s.step2.placeholderValues ?? {}), ...preFilledPlaceholders },
      },
      step3: { ...s.step3, sections: parsedSections },
      // Skip Step 1 — drafter lands on Key Terms.
      currentStep: 2,
    }));
  }, [wantsWorkOrderSeed, workOrderSeedReady, workOrderQuery.data, extractQuery.data, setState]);

  // M21 — when seeded from a work order, drop Step 1 (template picker) from
  // the visible flow. The drafter lands on Step 2 (Key Terms).
  const stepOrder: readonly ComposeWizardStep[] = wantsWorkOrderSeed
    ? ([2, 3, 5] as const)
    : STEP_ORDER;

  const currentStep = state.currentStep;
  const stepIndex = stepOrder.indexOf(currentStep);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === stepOrder.length - 1;

  // Per-step validity — used to disable "Next" until the current step is
  // valid. Re-evaluates on every render against the canonical schema; this
  // keeps the wizard parent independent of the step components' RHF state.
  //
  // Compose-revamp 2026-06-03: Step 2 additionally requires that every
  // template placeholder marked `required` has a non-empty value typed.
  const placeholdersOk = useMemo(() => {
    const placeholders = activeTemplate?.placeholders ?? virtualTemplate?.placeholders ?? [];
    const required = placeholders.filter((p) => p.required);
    if (required.length === 0) return true;
    const vals = state.step2.placeholderValues ?? {};
    return required.every((p) => {
      const v = vals[p.key];
      return typeof v === "string" && v.trim().length > 0;
    });
  }, [activeTemplate, virtualTemplate, state.step2.placeholderValues]);

  const stepValidity = useMemo(() => {
    const v1 = composeStep1Schema.safeParse(state.step1);
    const v2 = composeStep2Schema.safeParse(state.step2);
    const v3 = composeStep3Schema.safeParse(state.step3);
    return {
      1: v1.success,
      2: v2.success && placeholdersOk,
      3: v3.success,
      5: v1.success && v2.success && v3.success && placeholdersOk,
    } as Record<ComposeWizardStep, boolean>;
  }, [state.step1, state.step2, state.step3, placeholdersOk]);

  // Step 1 / 2 / 3 onChange handlers are stable per step — they update the
  // matching slice and leave the rest untouched. We deliberately don't
  // useCallback because state setters are already stable identity.
  const updateStep1 = (next: ComposeWizardStep1Type) => {
    setState((s) => ({ ...s, step1: next }));
  };
  const updateStep2 = (next: ComposeWizardStep2Parties) => {
    setState((s) => ({ ...s, step2: next }));
  };
  const updateStep3 = (next: ComposeWizardStep3ClausesBody) => {
    setState((s) => ({ ...s, step3: next }));
  };

  const goToStep = (target: ComposeWizardStep) => {
    setState((s) => ({ ...s, currentStep: target }));
  };

  const handleNext = () => {
    if (!stepValidity[currentStep]) return;
    const next = stepOrder[stepIndex + 1];
    if (next) goToStep(next);
  };

  const handleBack = () => {
    const prev = stepOrder[stepIndex - 1];
    if (prev) goToStep(prev);
  };

  const handleSubmit = async () => {
    if (!stepValidity[5]) return;
    const result = await submit(state, user?.id ?? null);
    // M21 — when seeded from a work order, link the new contract to it so
    // the existing status-change trigger auto-completes the work order on
    // submit-for-approval.
    if (result?.contractId && fromWorkOrderId) {
      try {
        await workOrdersService.linkTarget(fromWorkOrderId, result.contractId);
        // 2026-06-12 — bust My Work queries a second time so the Stage column
        // reflects the target link + the just-created approval chain. The
        // first bust happens inside useComposeSubmit before linkTarget runs,
        // which is too early to capture target_contract_id / approver names.
        queryClient.invalidateQueries({ queryKey: workOrderKeys.all });
      } catch {
        // Non-fatal — the contract was created successfully.
      }
    }
  };

  const handleRetryStep2 = async () => {
    await retryStep2(state, user?.id ?? null);
  };

  const handleDiscard = () => {
    if (typeof window !== "undefined") {
      clearComposeDraft(user?.id ?? null, draftId);
    }
    void navigate({ to: "/app/contracts" });
  };

  // T13 — scrub sensitive bodies on unmount (FE-C1 pattern from M1a).
  useEffect(() => {
    return () => {
      // Only clear in-memory React state; localStorage draft persists per
      // AC-S1-07 unless cleared by submit / discard.
      setState((s) => ({
        ...s,
        step3: { bodyEn: null, bodyAr: null },
      }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // M21 — when entered from a work order, block until the AI extraction is
  // done. Without it, the placeholder catalog + redacted body aren't ready
  // and Step 2/3 would mount with empty state.
  if (wantsWorkOrderSeed && !workOrderSeededRef.current) {
    return (
      <WorkOrderSeedLoading
        workOrderLoaded={!!workOrderQuery.data}
        extractLoaded={!!extractQuery.data}
        extractError={extractQuery.isError}
        onRetry={() => {
          // Refire both queries — work-order fetch is cheap and ensures we
          // pick up any backend-side changes before re-running the AI extract.
          void workOrderQuery.refetch();
          void extractQuery.refetch();
        }}
      />
    );
  }

  // Block wizard render until template prefill has been applied to draft
  // state — Step1Type's RHF form snapshots its defaultValues at mount, so
  // mounting it before the prefill setState would lose the prefill values.
  if (wantsPrefill && state.step1.templateId !== prefillTemplateId && !prefillError) {
    return (
      <div
        className="mx-auto w-full max-w-4xl space-y-4 p-6"
        role="status"
        aria-live="polite"
        aria-busy={prefillLoading}
      >
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-surface" />
        <div className="h-32 animate-pulse rounded-lg bg-surface" />
        <div className="h-72 animate-pulse rounded-lg bg-surface" />
        <p className="text-xs text-ink-subtle">
          {t("contracts.compose.prefill.loading", {
            defaultValue: "Loading template…",
          })}
        </p>
      </div>
    );
  }

  // RBAC defense-in-depth: redirect users who don't have contract.draft.
  // BE will return 403 anyway on submit, but rendering the wizard at all
  // wastes the user's time.
  if (!canDraft) {
    return (
      <div className="mx-auto w-full max-w-md p-12 text-center" role="alert" aria-live="polite">
        <h1 className="text-base font-semibold text-ink">{t("contracts.detail.forbidden")}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("contracts.compose.forbiddenSubtitle")}</p>
        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void navigate({ to: "/app/contracts" })}
          >
            {t("contracts.detail.backToList")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-4xl space-y-4 p-6"
    >
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("contracts.compose.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t("contracts.compose.subtitle")}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDiscard}
          disabled={isSubmitting}
        >
          {t("contracts.compose.discardDraft")}
        </Button>
      </header>

      {prefillTemplate && state.step1.templateId === prefillTemplate.id && (
        <div className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-ink">
          <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
          <span>
            {t("contracts.compose.prefill.banner", {
              defaultValue: "Started from template: {{name}}",
              name: prefillTemplate.nameEn,
            })}
          </span>
        </div>
      )}

      {wantsWorkOrderSeed && workOrderQuery.data && (
        <div className="flex items-start gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-ink">
          <Sparkles className="h-4 w-4 text-gold mt-0.5" aria-hidden="true" />
          <span>
            {t("contracts.compose.workOrderSeed.banner", {
              defaultValue:
                "Drafting from {{number}}. AI extracted {{count}} placeholders + redacted the body — fill in Key Terms below.",
              number: workOrderQuery.data.sourceContractNumber ?? "—",
              count: extractQuery.data?.placeholders.length ?? 0,
            })}
          </span>
        </div>
      )}

      {prefillError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <span>
            {t("contracts.compose.prefill.error", {
              defaultValue: "Failed to load template — starting from a blank draft.",
            })}
          </span>
        </div>
      )}

      {/* Progress indicator (AC-S1-11) */}
      <Card>
        <CardContent className="p-4">
          <ol
            aria-label={t("contracts.compose.progressLabel")}
            className="flex flex-wrap items-center gap-2 text-xs text-ink-muted"
          >
            {stepOrder.map((s, i) => {
              const isCurrent = s === currentStep;
              const isComplete = stepOrder.indexOf(s) < stepIndex && stepValidity[s];
              return (
                <li key={s} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goToStep(s)}
                    aria-current={isCurrent ? "step" : undefined}
                    disabled={isSubmitting}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      isCurrent ? "bg-accent text-accent-foreground font-medium" : "",
                      isComplete ? "text-ink" : "",
                    )}
                  >
                    <span className="font-mono">
                      {t("contracts.compose.stepIndex", { n: i + 1, total: stepOrder.length })}
                    </span>
                    <span>{t(`contracts.compose.steps.step${s}.tabLabel`)}</span>
                  </button>
                  {i < stepOrder.length - 1 && (
                    <span aria-hidden="true" className="text-ink-subtle">
                      ›
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Step body — aria-live so step transitions announce to AT */}
      <div aria-live="polite" aria-atomic="false">
        {currentStep === 1 && (
          <Step1Type value={state.step1} onChange={updateStep1} disabled={isSubmitting} />
        )}
        {currentStep === 2 && (
          <Step2Parties
            value={state.step2}
            onChange={updateStep2}
            disabled={isSubmitting}
            templatePlaceholders={activeTemplate?.placeholders ?? virtualTemplate?.placeholders ?? []}
            ourPartyName={state.step1.ourPartyName ?? null}
            counterpartyName={state.step1.counterpartyName ?? null}
            contractLanguage={state.step1.language}
            contractType={state.step1.contractType ?? null}
          />
        )}
        {currentStep === 3 && (
          <Step3Terms
            value={state.step3}
            onChange={updateStep3}
            disabled={isSubmitting}
            placeholderValues={state.step2.placeholderValues ?? {}}
            contractLanguage={state.step1.language}
            inTemplateClauseIds={inTemplateClauseIds}
          />
        )}
        {currentStep === 5 && (
          <Step5Review state={state} placeholderValues={state.step2.placeholderValues ?? {}} />
        )}
      </div>

      {/* Inline error + retry (AC-S1-08) */}
      {submitError && submitError.phase === "saving-schedule" && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-destructive">
                {t("contracts.compose.errors.scheduleFailedTitle")}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {t("contracts.compose.errors.scheduleFailedDescription", {
                  number: submitError.contractNumber ?? "",
                })}
              </p>
              <p className="mt-1 text-[11px] text-ink-subtle">
                {translateApiError(submitError.error, t)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRetryStep2}
              disabled={isSubmitting}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("contracts.compose.errors.retrySchedule")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 2026-06-11 — approval-routing failure surface. The contract row was
          created but submit-for-approval failed; let the drafter retry from
          here so they don't have to leave the wizard and find the contract. */}
      {submitError && submitError.phase === "sending-for-approval" && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-destructive">
                {t("contracts.compose.errors.approvalRoutingFailedTitle", {
                  defaultValue: "Approval routing failed",
                })}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {t("contracts.compose.errors.approvalRoutingFailedDescription", {
                  defaultValue:
                    "Contract {{number}} was created as a draft but the approval chain wasn't started. Try again, or open the contract and submit from there.",
                  number: submitError.contractNumber ?? "",
                })}
              </p>
              <p className="mt-1 text-[11px] text-ink-subtle">
                {translateApiError(submitError.error, t)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRetryStep2}
              disabled={isSubmitting}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("contracts.compose.errors.retryApprovalRouting", {
                defaultValue: "Retry routing",
              })}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Footer nav */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={handleBack}
          disabled={isFirstStep || isSubmitting}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>

        <div className="text-xs text-ink-subtle">
          {phase === "creating-contract" && t("contracts.compose.phases.creatingContract")}
          {phase === "saving-schedule" && t("contracts.compose.phases.savingSchedule")}
        </div>

        {!isLastStep ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!stepValidity[currentStep] || isSubmitting}
          >
            {t("common.next")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={!stepValidity[5] || isSubmitting}>
            {isSubmitting ? t("common.saving") : t("contracts.compose.submit")}
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default ComposeWizard;

// ============================================================
// Work-order seed loading screen — REAL percentage progress bar.
// ============================================================
// The BE doesn't stream extract progress, so the percentage is a
// time-based estimate using the standard ramp-and-asymptote technique:
// fast at first, slows as it approaches 95%, then jumps to 100% the
// moment the actual extract query resolves. Feels honest and avoids
// the "blackhole" issue of indeterminate spinners.
interface WorkOrderSeedLoadingProps {
  workOrderLoaded: boolean;
  extractLoaded: boolean;
  extractError: boolean;
  /** 2026-06-11 — fired when the drafter clicks Try again on the error UI. */
  onRetry: () => void;
}

// Empirically the gpt-4o-mini extract takes ~30–45s on a full MSA. We
// hit 90% at ~30s and asymptote toward 95% — this leaves headroom so we
// don't sit at "99%" for ages if the call is slow.
const EXPECTED_DURATION_MS = 32_000;

// 2026-06-11 — client-side ceiling. If the extract hasn't returned in this
// long, treat the wizard as effectively errored so the Try again button
// renders. Without this the drafter sits on the loading screen indefinitely
// when the upstream call hangs (no client timeout was firing previously).
const EXTRACT_TIMEOUT_MS = 90_000;

function WorkOrderSeedLoading({
  workOrderLoaded,
  extractLoaded,
  extractError,
  onRetry,
}: WorkOrderSeedLoadingProps): JSX.Element {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (extractLoaded) {
      setProgress(100);
      setTimedOut(false);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - startedAtRef.current;
      // Asymptote to 95% over EXPECTED_DURATION_MS:
      //   p = 95 * (1 - e^(-t/τ))   where τ = duration/3 so we're at ~95%
      //   when t == duration.
      const tau = EXPECTED_DURATION_MS / 3;
      const p = 95 * (1 - Math.exp(-elapsed / tau));
      setProgress(Math.min(95, p));
      if (elapsed >= EXTRACT_TIMEOUT_MS) setTimedOut(true);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [extractLoaded]);

  // 2026-06-11 — surface error UI when the BE actually errored OR when the
  // client-side ceiling was hit without a response.
  const showError = extractError || timedOut;

  const handleRetry = () => {
    // Reset the local timer + progress so the new attempt starts fresh.
    startedAtRef.current = Date.now();
    setProgress(0);
    setTimedOut(false);
    onRetry();
  };

  const phaseSteps: Array<{ key: string; labelKey: string; done: boolean; active: boolean }> = [
    {
      key: "load",
      labelKey: "contracts.compose.workOrderSeed.phase.loadWorkOrder",
      done: workOrderLoaded,
      active: !workOrderLoaded,
    },
    {
      key: "extract",
      labelKey: "contracts.compose.workOrderSeed.phase.aiExtract",
      done: extractLoaded,
      active: workOrderLoaded && !extractLoaded,
    },
    {
      key: "build",
      labelKey: "contracts.compose.workOrderSeed.phase.buildWizard",
      done: false,
      active: extractLoaded,
    },
  ];

  const pct = Math.round(progress);

  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 py-12"
      role="status"
      aria-live="polite"
      aria-busy
    >
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 to-transparent p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10">
            <Sparkles className="h-5 w-5 text-gold animate-pulse" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-ink">
              {t("contracts.compose.workOrderSeed.loadingTitle", {
                defaultValue: "Composing your draft…",
              })}
            </h1>
            <p className="text-xs text-ink-muted">
              {t("contracts.compose.workOrderSeed.loadingSubtitle", {
                defaultValue:
                  "AI is reading the source contract and detecting placeholders.",
              })}
            </p>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-gold">
            {pct}%
          </div>
        </div>

        {/* Determinate progress bar */}
        <div
          className="mt-6 h-2 w-full overflow-hidden rounded-full bg-gold/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-gold/80 to-gold rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Phase checklist for context */}
        <ol className="mt-6 space-y-2.5 text-sm">
          {phaseSteps.map((step) => (
            <li
              key={step.key}
              className={cn(
                "flex items-start gap-2.5 transition-opacity",
                step.done ? "opacity-90" : step.active ? "opacity-100" : "opacity-40",
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-sage mt-0.5 shrink-0" />
              ) : step.active ? (
                <Sparkles className="h-4 w-4 text-gold mt-0.5 shrink-0 animate-pulse" />
              ) : (
                <Circle className="h-4 w-4 text-ink-subtle/40 mt-0.5 shrink-0" />
              )}
              <span className={step.done ? "text-ink" : step.active ? "text-ink font-medium" : "text-ink-muted"}>
                {t(step.labelKey, {
                  defaultValue:
                    step.key === "load"
                      ? "Reading the work order"
                      : step.key === "extract"
                        ? "Extracting structure + placeholders (this can take up to a minute)"
                        : "Setting up your wizard",
                })}
              </span>
            </li>
          ))}
        </ol>

        {showError && (
          <div className="mt-5 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <p>
                {extractError
                  ? t("contracts.compose.workOrderSeed.extractError", {
                      defaultValue:
                        "Couldn't read the source contract. The AI extract failed.",
                    })
                  : t("contracts.compose.workOrderSeed.extractTimeout", {
                      defaultValue:
                        "The AI extract is taking longer than expected. The upstream call may be stuck.",
                    })}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRetry}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("contracts.compose.workOrderSeed.tryAgain", {
                  defaultValue: "Try again",
                })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

