/**
 * useComposeSubmit — Compose Wizard FE-only orchestration (AC-S1-08).
 *
 * Per Q2 Option (b) — NO new BE endpoint, NO fn_contract_create_with_schedule
 * wrapper. The Submit handler calls TWO existing endpoints in sequence:
 *
 *   1. POST /api/v1/contracts                        (M1a fn_contract_create)
 *   2. PUT  /api/v1/contracts/{id}/payment-schedules (M1b fn_payment_schedule_create_bulk)
 *
 * Failure modes (AC-S1-08):
 *   - Step 1 fails: nothing was written. Toast shows the error; the wizard
 *     state is preserved for the user to retry. No retry-only-step-2 path
 *     is exposed because there is no contract id to retry against.
 *   - Step 2 fails: the contract row is already created in 'draft' state.
 *     We do NOT roll it back — drafts can validly exist with no payment
 *     schedule. Instead we surface a "Retry payment schedule" affordance
 *     (returned via `retryStep2`), which the wizard exposes as a button on
 *     the toast or step-5 panel. Re-attempts ONLY the second call.
 *
 * On total success:
 *   - Clear localStorage draft (AC-S1-09).
 *   - Toast with the auto-generated CT-YYYY-NNNNNN contract number.
 *   - Caller redirects to /app/contracts/{id} (AC-S1-10).
 *
 * Why a custom hook (not a single useMutation): TanStack Query mutations
 * are designed for ONE call. We need TWO sequential calls with distinct
 * error handling per step. We expose a single boolean `isSubmitting` and
 * a step-tracking string for the UI; the underlying calls go through the
 * service layer directly so we don't lose error fidelity.
 */

import { useCallback, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { contractsService } from "@/services/api/contracts.service";
import { paymentScheduleService } from "@/services/api/payment-schedule.service";
import { partiesService } from "@/services/api/m_parity.service";
import { ApiError } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";
import { contractsKeys } from "@/features/contracts/hooks/useContracts";
import { paymentScheduleKeys } from "@/features/contracts/hooks/usePaymentSchedule";
import { clearComposeDraft } from "./useComposeDraft";
import { GOVERNING_LAW_VALUES } from "@/types/entities/contract.types";
import type { CreateContractDto, CreateContractResponse, GoverningLaw } from "@/types/entities/contract.types";
import type {
  ComposeWizardState,
  PaymentScheduleCreateDto,
} from "@/types/entities/payment-schedule.types";

/** Internal — which step is currently in flight. */
export type ComposeSubmitPhase = "idle" | "creating-contract" | "saving-schedule" | "done";

/** Result returned by useComposeSubmit().submit(). */
export interface ComposeSubmitResult {
  /** Always populated on success. */
  contractId: number;
  /** Only populated when step 1 succeeded; useful for retry-step-2. */
  contractNumber: string;
}

interface SubmitErrorState {
  phase: Exclude<ComposeSubmitPhase, "idle" | "done">;
  error: ApiError | Error;
  /** Server-issued contract id, if step 1 succeeded. Allows retry of step 2 only. */
  contractId: number | null;
  contractNumber: string | null;
}

interface UseComposeSubmitReturn {
  /** Run the full 2-call orchestration. */
  submit: (state: ComposeWizardState, userId: number | null) => Promise<ComposeSubmitResult | null>;
  /**
   * Re-attempt ONLY the payment-schedule call. The wizard renders this on
   * the error toast / step 5 panel after a step-2 failure. AC-S1-08.
   */
  retryStep2: (
    state: ComposeWizardState,
    userId: number | null,
  ) => Promise<ComposeSubmitResult | null>;
  /** True while either step is in flight. */
  isSubmitting: boolean;
  /** Granular phase indicator — useful for the "Saving milestones…" UI hint. */
  phase: ComposeSubmitPhase;
  /** Last failure (cleared on next attempt). */
  error: SubmitErrorState | null;
}

/**
 * Resolve the typed Step 1 party names to party IDs. When the drafter
 * picked a value from the datalist, the resolver in Step 1 has already
 * populated `ourPartyId` / `counterpartyId`. When they typed a fresh name
 * that doesn't match the catalog, we create a new party row now (kind=
 * company, name_en = typed string) and capture the returned id. Any
 * failure is swallowed — we fall back to leaving the id null so the
 * contract still creates, just without the parties graph link.
 */
async function ensureParties(state: ComposeWizardState): Promise<ComposeWizardState> {
  let { ourPartyId, counterpartyId } = state.step1;
  const ourName = (state.step1.ourPartyName ?? "").trim();
  const cpName = (state.step1.counterpartyName ?? "").trim();

  if (ourName && (ourPartyId == null || !Number.isFinite(ourPartyId))) {
    try {
      const row = await partiesService.create({ partyType: "company", nameEn: ourName });
      ourPartyId = row.id;
    } catch {
      ourPartyId = null;
    }
  }
  if (cpName && (counterpartyId == null || !Number.isFinite(counterpartyId))) {
    try {
      const row = await partiesService.create({ partyType: "company", nameEn: cpName });
      counterpartyId = row.id;
    } catch {
      counterpartyId = null;
    }
  }
  return {
    ...state,
    step1: { ...state.step1, ourPartyId, counterpartyId },
  };
}

/**
 * Substitute `{{token}}` occurrences in a body with the matching value from
 * the wizard's placeholderValues dict. Templates often wrap placeholders in
 * markdown bold (e.g. `**{{discloser_name}}**`); when a value is available we
 * also strip the surrounding `**` markers so the saved document reads as
 * `OqoodAI FZ-LLC` instead of `**OqoodAI FZ-LLC**`. Unfilled tokens keep the
 * surrounding formatting so the visual gap stays obvious.
 */
function substitutePlaceholders(
  body: string | null | undefined,
  values: Record<string, string> | undefined,
): string | null {
  if (typeof body !== "string" || body.trim() === "") return null;
  if (!values) return body;

  // Pass 1 — drop `**{{token}}**` (bold-wrapped) when value present.
  let out = body.replace(/\*\*\{\{([a-zA-Z0-9_]+)\}\}\*\*/g, (raw, key) => {
    const v = values[key];
    return typeof v === "string" && v.trim() !== "" ? v : raw;
  });
  // Pass 2 — replace any remaining bare `{{token}}`.
  out = out.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (raw, key) => {
    const v = values[key];
    return typeof v === "string" && v.trim() !== "" ? v : raw;
  });
  return out;
}

/**
 * Hoist values from the template's placeholder dict into the head-field
 * shape the BE expects. Used at submit time because Step 2 suppresses the
 * head-field inputs when an equivalent placeholder is present — without
 * this lift, the resulting contract row has NULL columns even though the
 * drafter actually filled the values.
 *
 * Mapping (mirror of the Step 2 dedup map):
 *   effective_date | start_date    → startDate
 *   end_date                       → endDate
 *   emirate | governing_emirate    → emirate
 *   jurisdiction_court | arbitration_seat → jurisdictionCourt
 *   governing_law                  → governingLaw (must be in enum, else dropped)
 *
 * We never CLOBBER a value the drafter actually typed in the Key Terms
 * block — those win over the placeholder fallback.
 */
function hoistPlaceholdersIntoHead(
  current: {
    startDate?: string | null;
    endDate?: string | null;
    emirate?: string | null;
    jurisdictionCourt?: string | null;
    governingLaw?: unknown;
  },
  values: Record<string, string> | undefined,
): {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  emirate: string | null | undefined;
  jurisdictionCourt: string | null | undefined;
  governingLaw: unknown;
} {
  const pick = (k: string): string | null => {
    const v = values?.[k];
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };
  const filled = (v: string | null | undefined): v is string =>
    typeof v === "string" && v.trim() !== "";

  return {
    startDate: filled(current.startDate)
      ? current.startDate
      : (pick("effective_date") ?? pick("start_date")),
    endDate: filled(current.endDate) ? current.endDate : pick("end_date"),
    emirate: filled(current.emirate)
      ? current.emirate
      : (pick("emirate") ?? pick("governing_emirate")),
    jurisdictionCourt: filled(current.jurisdictionCourt)
      ? current.jurisdictionCourt
      : (pick("jurisdiction_court") ?? pick("arbitration_seat")),
    governingLaw: current.governingLaw ?? pick("governing_law"),
  };
}

/**
 * Build the CreateContractDto from wizard state. Strips empty strings to
 * undefined / null so the BE applies defaults (matches the same `orUndef` /
 * `orNull` pattern used by ContractCreateForm).
 */
function buildCreateDto(state: ComposeWizardState): CreateContractDto {
  const { step1, step2, step3 } = state;

  const orUndef = (v: string | null | undefined): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v : undefined;
  const orNull = (v: string | null | undefined): string | null | undefined =>
    typeof v === "string" && v.trim() === "" ? null : (v ?? undefined);

  const placeholderValues = step2.placeholderValues ?? {};

  // Hoist suppressed-but-captured fields back into the head columns so
  // queries that join on startDate / emirate / jurisdiction still match.
  const hoisted = hoistPlaceholdersIntoHead(
    {
      startDate: step2.startDate,
      endDate: step2.endDate,
      emirate: step2.emirate,
      jurisdictionCourt: step2.jurisdictionCourt,
      governingLaw: step2.governingLaw ?? null,
    },
    placeholderValues,
  );

  return {
    titleEn: step2.titleEn,
    titleAr: orNull(step2.titleAr),
    contractType: step1.contractType,
    language: step1.language,
    valueAed: step2.valueAed === null ? undefined : step2.valueAed,
    currency: orUndef(step2.currency),
    startDate: orNull(hoisted.startDate),
    endDate: orNull(hoisted.endDate),
    expiryNoticeDays: step2.expiryNoticeDays,
    emirate: orNull(hoisted.emirate),
    // governing_law column is enum-constrained — only accept the placeholder
    // string if it's actually a valid enum value; otherwise drop silently
    // so the BE doesn't 400 on a free-text "UAE Federal Law" value.
    governingLaw:
      typeof hoisted.governingLaw === "string" &&
      (GOVERNING_LAW_VALUES as readonly string[]).includes(hoisted.governingLaw)
        ? (hoisted.governingLaw as GoverningLaw)
        : undefined,
    jurisdictionCourt: orNull(hoisted.jurisdictionCourt),
    parentContractId: step2.parentContractId ?? undefined,
    relationshipType: step2.relationshipType ?? undefined,
    // Substitute {{tokens}} so the saved body is the final document.
    bodyEn: orNull(substitutePlaceholders(step3.bodyEn, placeholderValues)),
    bodyAr: orNull(substitutePlaceholders(step3.bodyAr, placeholderValues)),
    // Bind party IDs when the typed name resolved to an existing party row
    // (Step 1 datalist-backed lookup against /api/v1/parties). Names that
    // don't match any party stay unresolved — the contract is still created
    // (the BE allows null parties) but won't surface in the parties graph.
    ourPartyId: step1.ourPartyId ?? undefined,
    counterpartyId: step1.counterpartyId ?? undefined,
    // templateId remains null. Tags are not collected by the wizard (M1b).
  };
}

/**
 * Step 2 normalisation: strip empty optional strings to null, ensure
 * amountAed is a number. The Zod schema on the wizard enforces the
 * field-level invariants — this is a final defensive pass.
 */
function normaliseScheduleRows(rows: PaymentScheduleCreateDto[]): PaymentScheduleCreateDto[] {
  return rows.map((row) => {
    const orNull = (v: string | null | undefined): string | null =>
      v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v;
    return {
      milestoneLabelEn: row.milestoneLabelEn,
      milestoneLabelAr: orNull(row.milestoneLabelAr),
      milestoneNameEn: orNull(row.milestoneNameEn),
      milestoneNameAr: orNull(row.milestoneNameAr),
      amountAed: typeof row.amountAed === "number" ? row.amountAed : Number(row.amountAed),
      dueDate: orNull(row.dueDate),
      paidAt: orNull(row.paidAt),
      status: row.status,
      recurrence: row.recurrence ?? null,
      invoiceRef: orNull(row.invoiceRef),
    };
  });
}

export function useComposeSubmit(): UseComposeSubmitReturn {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<ComposeSubmitPhase>("idle");
  const [error, setError] = useState<SubmitErrorState | null>(null);

  // Stash the contract id from step 1 so retryStep2 can use it without
  // round-tripping through state. This survives re-renders because the ref
  // identity is stable across renders.
  const lastContractRef = useRef<{ id: number; number: string } | null>(null);

  // Synchronous double-submit guard (Codex F-FE-002 — HIGH). React state
  // updates batch and only commit on re-render, so two clicks in the same
  // tick both observe `isSubmitting === false` and fire two POST /contracts.
  // A ref flips synchronously; the second click is short-circuited.
  // Intentionally covers BOTH submit() and retryStep2(): a user mashing the
  // retry button must not trigger parallel PUT /payment-schedules either.
  const submittingRef = useRef(false);

  const isSubmitting = phase === "creating-contract" || phase === "saving-schedule";

  /**
   * Step 2 only — wrapped so submit() and retryStep2() share the call site.
   * Returns the new contract id + number on success; throws on failure.
   */
  const runStep2 = useCallback(
    async (
      contractId: number,
      contractNumber: string,
      state: ComposeWizardState,
      userId: number | null,
    ): Promise<ComposeSubmitResult> => {
      setPhase("saving-schedule");
      try {
        const rows = normaliseScheduleRows(state.step2.paymentSchedule);
        // Empty schedule is allowed at the wizard level — only call the
        // bulk endpoint when there's at least one row. AC-S2-04 confirms
        // empty payment schedule is valid.
        if (rows.length > 0) {
          await paymentScheduleService.bulkReplace(contractId, {
            rows,
            replaceExisting: true,
          });
          // Bust caches so the new tab in ContractDetail loads fresh.
          queryClient.invalidateQueries({
            queryKey: paymentScheduleKeys.list(contractId),
            exact: false,
          });
        }
        setPhase("done");
        // Success — clear draft + show toast + navigate.
        clearComposeDraft(userId, state.composeDraftId);
        toast.success(t("contracts.compose.toasts.submitSuccess", { number: contractNumber }));
        // Bust contract list so the new contract appears.
        queryClient.invalidateQueries({ queryKey: contractsKeys.lists() });
        // Defer navigation to next microtask so the toast registers in the
        // current TanStack Router render cycle before the route swap.
        void navigate({
          to: "/app/contracts/$id",
          params: { id: String(contractId) },
        });
        setError(null);
        lastContractRef.current = null;
        return { contractId, contractNumber };
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : (err as Error);
        setPhase("idle");
        setError({
          phase: "saving-schedule",
          error: apiErr,
          contractId,
          contractNumber,
        });
        toast.error(translateApiError(apiErr, t, "contracts.compose.toasts.scheduleError"));
        // Re-throw so the caller's try/catch can short-circuit. Wizard
        // typically just lets the error state drive the UI.
        throw apiErr;
      }
    },
    [navigate, queryClient, t],
  );

  /**
   * Full 2-call orchestration.
   */
  const submit = useCallback(
    async (
      state: ComposeWizardState,
      userId: number | null,
    ): Promise<ComposeSubmitResult | null> => {
      // F-FE-002: synchronous double-submit guard. If a previous submit (or
      // retry) is still in flight, drop this call silently. The Submit
      // button is also disabled by `isSubmitting`, but state updates aren't
      // synchronous — without this ref check, a fast second click in the
      // same tick would create a duplicate contract (POST /contracts twice).
      if (submittingRef.current) return null;
      submittingRef.current = true;
      try {
        // Reset prior error before starting.
        setError(null);
        setPhase("creating-contract");

        // Compose-revamp v3 2026-06-03 — auto-create party rows when the
        // drafter typed a fresh name that didn't resolve against the catalog
        // (Step 1 datalist match). Without this, our_party_id / counterparty_id
        // end up NULL and the Parties tab on the contract detail looks empty
        // even though both names were supplied. Failure here is non-fatal —
        // we fall back to NULL ids and still create the contract.
        const resolvedState = await ensureParties(state);

        let created: CreateContractResponse;
        try {
          created = await contractsService.create(buildCreateDto(resolvedState));
        } catch (err) {
          const apiErr = err instanceof ApiError ? err : (err as Error);
          setPhase("idle");
          setError({
            phase: "creating-contract",
            error: apiErr,
            contractId: null,
            contractNumber: null,
          });
          toast.error(translateApiError(apiErr, t, "contracts.compose.toasts.contractError"));
          return null;
        }

        lastContractRef.current = {
          id: created.id,
          number: created.contractNumber,
        };

        try {
          return await runStep2(created.id, created.contractNumber, resolvedState, userId);
        } catch {
          // runStep2 already populated `error` and showed a toast. Return
          // null to signal partial completion to the caller; the wizard will
          // render the retry affordance from the error state.
          return null;
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [runStep2, t],
  );

  /**
   * Retry only the payment-schedule call — the contract row already exists.
   */
  const retryStep2 = useCallback(
    async (
      state: ComposeWizardState,
      userId: number | null,
    ): Promise<ComposeSubmitResult | null> => {
      // F-FE-002: same lock as submit() so a click during retry can't fire
      // parallel PUT /payment-schedules calls. Falls through to submit()
      // when there's no prior step-1 success, but the lock is consistent.
      if (submittingRef.current) return null;
      const last = lastContractRef.current;
      if (!last) {
        // No prior step 1 success — fall through to a full submit so the
        // user isn't stuck if they somehow trigger retry without context.
        // submit() handles its own locking so we don't double-acquire.
        return submit(state, userId);
      }
      submittingRef.current = true;
      try {
        return await runStep2(last.id, last.number, state, userId);
      } catch {
        return null;
      } finally {
        submittingRef.current = false;
      }
    },
    [runStep2, submit],
  );

  return {
    submit,
    retryStep2,
    isSubmitting,
    phase,
    error,
  };
}
