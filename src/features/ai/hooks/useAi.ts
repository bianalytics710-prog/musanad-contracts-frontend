/**
 * Musanad — AI Features React Query hooks (M4).
 *
 * Non-streaming AI hooks (S1 non-stream modes, S3, S6). Streaming endpoints
 * (S1 summary/rewrite, S2, S4) live in their own SSE hooks.
 *
 * Conventions:
 *   - Errors funnelled through translateApiError — never raw err.message.
 *   - Sensitive request fields (selectedText, additions, deletions,
 *     modifiedClauses) flow through axios body only; never logged.
 *   - executiveAnomalies uses a custom mutation (not query) because it
 *     takes a stats payload that the caller composes from dashboard
 *     widgets — semantics are "fire on demand", not "fetched by route".
 *     The BE caches via ai_insight (1h TTL) so re-firing is cheap.
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";
import { aiService } from "@/services/api/ai.service";
import type {
  AiContractInsightsRequest,
  AiContractInsightsResponseBody,
  AiDraftingAssistantRequest,
  AiDraftingAssistantSuggestResponse,
  AiExecutiveAnomaliesRequest,
  AiExecutiveAnomaliesResponse,
  AiVersionDiffSummaryRequest,
  AiVersionDiffSummaryResponse,
} from "@/types/entities/ai.types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const aiKeys = {
  all: ["ai"] as const,
  contractInsights: (contractId: number, mode: string, language: string) =>
    [...aiKeys.all, "contractInsights", contractId, mode, language] as const,
  executiveAnomalies: (language: string) =>
    [...aiKeys.all, "executiveAnomalies", language] as const,
  versionDiffSummary: (
    contractId: number,
    leftId: number,
    rightId: number,
    language: string,
  ) =>
    [
      ...aiKeys.all,
      "versionDiffSummary",
      contractId,
      leftId,
      rightId,
      language,
    ] as const,
};

// ─── S1 — Contract Insights (non-streaming modes) ────────────────────────────

/**
 * Mutation wrapper for non-streaming contract insights modes:
 * key_terms / risks / obligations / regulatory.
 *
 * Use the SSE hook (useAiInsightsSseStream) for mode='summary' or 'rewrite'.
 */
export function useAiContractInsights(
  options?: UseMutationOptions<
    AiContractInsightsResponseBody,
    ApiError,
    AiContractInsightsRequest
  >,
) {
  const { t } = useTranslation();
  return useMutation<
    AiContractInsightsResponseBody,
    ApiError,
    AiContractInsightsRequest
  >({
    mutationFn: (payload) => aiService.contractInsights(payload),
    ...options,
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

// ─── S2 — Drafting Assistant (suggest only — non-streaming) ──────────────────

export function useAiDraftingAssistantSuggest(
  options?: UseMutationOptions<
    AiDraftingAssistantSuggestResponse,
    ApiError,
    AiDraftingAssistantRequest
  >,
) {
  const { t } = useTranslation();
  return useMutation<
    AiDraftingAssistantSuggestResponse,
    ApiError,
    AiDraftingAssistantRequest
  >({
    mutationFn: (payload) => aiService.draftingAssistantSuggest(payload),
    ...options,
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

// ─── S3 — Executive Anomalies (non-streaming, BE caches 1h) ──────────────────

export function useAiExecutiveAnomalies(
  options?: UseMutationOptions<
    AiExecutiveAnomaliesResponse,
    ApiError,
    AiExecutiveAnomaliesRequest
  >,
) {
  const { t } = useTranslation();
  return useMutation<
    AiExecutiveAnomaliesResponse,
    ApiError,
    AiExecutiveAnomaliesRequest
  >({
    mutationFn: (payload) => aiService.executiveAnomalies(payload),
    ...options,
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

// ─── S6 — Version Diff Summary (non-streaming, BE caches 7d, persists to DB) ─

export function useAiVersionDiffSummary(
  options?: UseMutationOptions<
    AiVersionDiffSummaryResponse,
    ApiError,
    AiVersionDiffSummaryRequest
  >,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation<
    AiVersionDiffSummaryResponse,
    ApiError,
    AiVersionDiffSummaryRequest
  >({
    mutationFn: (payload) => aiService.versionDiffSummary(payload),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // BE persists diffSummary to contract_version row — invalidate
      // any contract version queries for this contract.
      void queryClient.invalidateQueries({
        queryKey: ["contracts", "versions", variables.contractId],
        exact: false,
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
