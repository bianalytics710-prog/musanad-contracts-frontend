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
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Send, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore, selectHasPermission, selectUser } from "@/store/auth.store";
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
      ourPartyName: null,
      counterpartyName: null,
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
    },
    step3: {
      bodyEn: null,
      bodyAr: null,
    },
    currentStep: 1,
    composeDraftId,
  };
}

interface ComposeWizardProps {
  /** Optional override for the draft id (e.g., when resuming from a URL param). */
  composeDraftId?: string;
}

export function ComposeWizard({ composeDraftId }: ComposeWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const { submit, retryStep2, isSubmitting, phase, error: submitError } = useComposeSubmit();

  const currentStep = state.currentStep;
  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEP_ORDER.length - 1;

  // Per-step validity — used to disable "Next" until the current step is
  // valid. Re-evaluates on every render against the canonical schema; this
  // keeps the wizard parent independent of the step components' RHF state.
  const stepValidity = useMemo(() => {
    const v1 = composeStep1Schema.safeParse(state.step1);
    const v2 = composeStep2Schema.safeParse(state.step2);
    const v3 = composeStep3Schema.safeParse(state.step3);
    return {
      1: v1.success,
      2: v2.success,
      3: v3.success,
      5: v1.success && v2.success && v3.success,
    } as Record<ComposeWizardStep, boolean>;
  }, [state.step1, state.step2, state.step3]);

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
    const next = STEP_ORDER[stepIndex + 1];
    if (next) goToStep(next);
  };

  const handleBack = () => {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) goToStep(prev);
  };

  const handleSubmit = async () => {
    if (!stepValidity[5]) return;
    await submit(state, user?.id ?? null);
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

      {/* Progress indicator (AC-S1-11) */}
      <Card>
        <CardContent className="p-4">
          <ol
            aria-label={t("contracts.compose.progressLabel")}
            className="flex flex-wrap items-center gap-2 text-xs text-ink-muted"
          >
            {STEP_ORDER.map((s, i) => {
              const isCurrent = s === currentStep;
              const isComplete = STEP_ORDER.indexOf(s) < stepIndex && stepValidity[s];
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
                      {t("contracts.compose.stepIndex", { n: i + 1, total: STEP_ORDER.length })}
                    </span>
                    <span>{t(`contracts.compose.steps.step${s}.tabLabel`)}</span>
                  </button>
                  {i < STEP_ORDER.length - 1 && (
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
          <Step2Parties value={state.step2} onChange={updateStep2} disabled={isSubmitting} />
        )}
        {currentStep === 3 && (
          <Step3Terms value={state.step3} onChange={updateStep3} disabled={isSubmitting} />
        )}
        {currentStep === 5 && <Step5Review state={state} />}
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
