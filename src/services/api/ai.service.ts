/**
 * Musanad — AI Features API service (M4).
 *
 * Thin axios wrappers over /api/v1/ai/* and /api/v1/admin/ai/*. Paths and
 * shapes derived directly from .claude/workspace/current-module/api-contracts.json.
 *
 * 10 endpoints: 6 AI invocation + 4 admin observability.
 *  - 9 are JWT-auth (use the standard apiClient).
 *  - 1 is signed-PDF-token only (S5 — consumed server-side by the PDF generator
 *    pipeline — NOT wired into the FE in M4; out of scope for this service).
 *
 * STREAMING ENDPOINTS (S1 mode=summary|rewrite, S2 mode=chat|explain|rewrite,
 * S4 modes) are NOT implemented here — they need fetch + ReadableStream
 * because EventSource cannot send the Authorization header. See the M4 SSE
 * hooks (useAiInsightsSseStream, useAiDraftingSseStream, useAiRegulatoryImpactSseStream)
 * which mirror M3's useSignerQaSseStream pattern.
 *
 * Sensitive fields (selectedText, chatHistory, additions, deletions,
 * modifiedClauses, summaryEn, signedToken, ai_prompt_payload) flow through
 * axios body only and are NEVER console-logged. Pino redaction handles BE.
 */

import { apiClient, unwrap } from "@/lib/api-client";
import type {
  AiContractInsightsRequest,
  AiContractInsightsResponseBody,
  AiCostReportQuery,
  AiCostReportResponse,
  AiDraftingAssistantRequest,
  AiDraftingAssistantSuggestResponse,
  AiExecutiveAnomaliesRequest,
  AiExecutiveAnomaliesResponse,
  AiInsightListQuery,
  AiInsightListResponse,
  AiPromptListQuery,
  AiPromptListResponse,
  AiRequestLogListQuery,
  AiRequestLogListResponse,
  AiVersionDiffSummaryRequest,
  AiVersionDiffSummaryResponse,
} from "@/types/entities/ai.types";

const AI_BASE = "/api/v1/ai";
const ADMIN_AI_BASE = "/api/v1/admin/ai";

/**
 * Convert a query object into Axios `params` form. Strips undefined and
 * empty-string values; passes through booleans/numbers/strings unchanged.
 */
function toParams(q: object | undefined): Record<string, unknown> {
  if (!q) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

export const aiService = {
  // ── S1 — non-streaming contract insights (key_terms, risks, obligations, regulatory) ──
  /**
   * POST /api/v1/ai/contract-insights (authed, JWT).
   *
   * For mode='summary' or 'rewrite' use the SSE hook instead — those modes
   * stream tokens and this synchronous wrapper would buffer the whole stream
   * client-side defeating the purpose.
   */
  contractInsights: async (
    payload: AiContractInsightsRequest,
  ): Promise<AiContractInsightsResponseBody> => {
    if (payload.mode === "summary" || payload.mode === "rewrite") {
      throw new Error(
        "ai.service.contractInsights: mode='summary'|'rewrite' must use the SSE streaming hook (useAiInsightsSseStream).",
      );
    }
    const { data } = await apiClient.post(
      `${AI_BASE}/contract-insights`,
      payload,
    );
    return unwrap<AiContractInsightsResponseBody>(data);
  },

  // ── S2 — drafting assistant — non-streaming (suggest only) ─────────────────
  /**
   * POST /api/v1/ai/drafting-assistant (authed, JWT) — mode='suggest' only.
   *
   * For mode='chat' / 'explain' / 'rewrite' use the SSE hook.
   */
  draftingAssistantSuggest: async (
    payload: AiDraftingAssistantRequest,
  ): Promise<AiDraftingAssistantSuggestResponse> => {
    if (payload.mode !== "suggest") {
      throw new Error(
        "ai.service.draftingAssistantSuggest: only mode='suggest' is synchronous; use the SSE hook for chat/explain/rewrite.",
      );
    }
    const { data } = await apiClient.post(
      `${AI_BASE}/drafting-assistant`,
      payload,
    );
    return unwrap<AiDraftingAssistantSuggestResponse>(data);
  },

  // ── S3 — executive anomalies (non-streaming, cached 1h) ────────────────────
  /** POST /api/v1/ai/executive-anomalies (authed, JWT). */
  executiveAnomalies: async (
    payload: AiExecutiveAnomaliesRequest,
  ): Promise<AiExecutiveAnomaliesResponse> => {
    const { data } = await apiClient.post(
      `${AI_BASE}/executive-anomalies`,
      payload,
    );
    return unwrap<AiExecutiveAnomaliesResponse>(data);
  },

  // S4 — regulatory impact: SSE-only — see useAiRegulatoryImpactSseStream.

  // ── S6 — version diff summary (non-streaming, cached 7d) ───────────────────
  /** POST /api/v1/ai/version-diff-summary (authed, JWT). */
  versionDiffSummary: async (
    payload: AiVersionDiffSummaryRequest,
  ): Promise<AiVersionDiffSummaryResponse> => {
    const { data } = await apiClient.post(
      `${AI_BASE}/version-diff-summary`,
      payload,
    );
    return unwrap<AiVersionDiffSummaryResponse>(data);
  },

  // ── S11 — admin observability — list ai_request_log rows ──────────────────
  /** GET /api/v1/admin/ai/requests (authed, JWT, ai.observability.read). */
  adminRequestsList: async (
    query: AiRequestLogListQuery = {},
  ): Promise<AiRequestLogListResponse> => {
    const { data } = await apiClient.get<AiRequestLogListResponse>(
      `${ADMIN_AI_BASE}/requests`,
      { params: toParams(query) },
    );
    return data;
  },

  // ── S11 — admin observability — list ai_insight rows ──────────────────────
  /** GET /api/v1/admin/ai/insights (authed, JWT, ai.observability.read). */
  adminInsightsList: async (
    query: AiInsightListQuery = {},
  ): Promise<AiInsightListResponse> => {
    const { data } = await apiClient.get<AiInsightListResponse>(
      `${ADMIN_AI_BASE}/insights`,
      { params: toParams(query) },
    );
    return data;
  },

  // ── S12 — admin AI cost report ────────────────────────────────────────────
  /** GET /api/v1/admin/ai/cost-report (authed, JWT, ai.observability.read). */
  adminCostReport: async (
    query: AiCostReportQuery,
  ): Promise<AiCostReportResponse> => {
    const { data } = await apiClient.get<AiCostReportResponse>(
      `${ADMIN_AI_BASE}/cost-report`,
      { params: toParams(query) },
    );
    return data;
  },

  // ── S13 — admin prompts list ──────────────────────────────────────────────
  /** GET /api/v1/admin/ai/prompts (authed, JWT, ai.observability.read). */
  adminPromptsList: async (
    query: AiPromptListQuery = {},
  ): Promise<AiPromptListResponse> => {
    const { data } = await apiClient.get<AiPromptListResponse>(
      `${ADMIN_AI_BASE}/prompts`,
      { params: toParams(query) },
    );
    return data;
  },
};

// ─── SSE URL builders (used by the streaming hooks) ───────────────────────────

const DEFAULT_BASE_URL = "http://localhost:4000";

function getBaseUrl(): string {
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return env && env.trim() !== "" ? env : DEFAULT_BASE_URL;
}

/** Absolute URL for POST /api/v1/ai/contract-insights (used by SSE hook). */
export function buildContractInsightsUrl(): string {
  return `${getBaseUrl()}${AI_BASE}/contract-insights`;
}

/** Absolute URL for POST /api/v1/ai/drafting-assistant (used by SSE hook). */
export function buildDraftingAssistantUrl(): string {
  return `${getBaseUrl()}${AI_BASE}/drafting-assistant`;
}

/** Absolute URL for POST /api/v1/ai/regulatory-impact (used by SSE hook). */
export function buildRegulatoryImpactUrl(): string {
  return `${getBaseUrl()}${AI_BASE}/regulatory-impact`;
}

export default aiService;
