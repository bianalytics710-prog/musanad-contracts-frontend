/**
 * Musanad — Admin AI Observability React Query hooks (M4 — S11/S12/S13).
 *
 * Read-only admin views over ai_request_log + ai_insight + ai_prompt.
 * All endpoints require `ai.observability.read` permission (BE-enforced).
 *
 * Conventions:
 *   - errors funnelled via translateApiError (no toast in onError because
 *     these are read-only views — surface the error inline in the view's
 *     three-data-state render).
 *   - keepPreviousData on list queries for smooth pagination UX.
 *
 * Sensitive fields:
 *   - ai_request_log.errorMessage is already redacted at write time per
 *     AC-S10-07 + DN-C; FE treats it as displayable but never re-logs it.
 *   - ai_insight.payload may contain rendered AI output — don't persist
 *     to localStorage / sessionStorage.
 */

import {
  keepPreviousData,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { aiService } from "@/services/api/ai.service";
import type {
  AiCostReportQuery,
  AiCostReportResponse,
  AiInsightListQuery,
  AiInsightListResponse,
  AiPromptListQuery,
  AiPromptListResponse,
  AiRequestLogListQuery,
  AiRequestLogListResponse,
} from "@/types/entities/ai.types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const adminAiKeys = {
  all: ["admin-ai"] as const,
  requestsList: (q: AiRequestLogListQuery) =>
    [...adminAiKeys.all, "requests", q] as const,
  insightsList: (q: AiInsightListQuery) =>
    [...adminAiKeys.all, "insights", q] as const,
  costReport: (q: AiCostReportQuery) =>
    [...adminAiKeys.all, "costReport", q] as const,
  promptsList: (q: AiPromptListQuery) =>
    [...adminAiKeys.all, "prompts", q] as const,
};

// ─── S11 — Admin AI Requests List ────────────────────────────────────────────

export function useAdminAiRequestsList(
  query: AiRequestLogListQuery,
  options?: Omit<
    UseQueryOptions<AiRequestLogListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<AiRequestLogListResponse, ApiError>({
    queryKey: adminAiKeys.requestsList(query),
    queryFn: () => aiService.adminRequestsList(query),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    ...options,
  });
}

// ─── S11 — Admin AI Insights (cache contents) List ───────────────────────────

export function useAdminAiInsightsList(
  query: AiInsightListQuery,
  options?: Omit<
    UseQueryOptions<AiInsightListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<AiInsightListResponse, ApiError>({
    queryKey: adminAiKeys.insightsList(query),
    queryFn: () => aiService.adminInsightsList(query),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    ...options,
  });
}

// ─── S12 — Admin AI Cost Report ──────────────────────────────────────────────

export function useAdminAiCostReport(
  query: AiCostReportQuery,
  options?: Omit<
    UseQueryOptions<AiCostReportResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery<AiCostReportResponse, ApiError>({
    queryKey: adminAiKeys.costReport(query),
    queryFn: () => aiService.adminCostReport(query),
    placeholderData: keepPreviousData,
    // Cost report is computed server-side; cache 5 min between refreshes.
    staleTime: 5 * 60_000,
    enabled:
      options?.enabled !== false &&
      Boolean(query.fromDate) &&
      Boolean(query.toDate),
    ...options,
  });
}

// ─── S13 — Admin AI Prompts List ─────────────────────────────────────────────

export function useAdminAiPromptsList(
  query: AiPromptListQuery = {},
  options?: Omit<
    UseQueryOptions<AiPromptListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<AiPromptListResponse, ApiError>({
    queryKey: adminAiKeys.promptsList(query),
    queryFn: () => aiService.adminPromptsList(query),
    // Prompt config is rarely touched — long stale time.
    staleTime: 10 * 60_000,
    ...options,
  });
}
