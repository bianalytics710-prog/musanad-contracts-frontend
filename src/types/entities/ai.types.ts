// ============================================================
// M4 — AI Features — Frontend TypeScript Type Definitions
// Project: Musanad Contracts Hub (musanad-contracts)
// Source of truth: .claude/workspace/current-module/types.ts (Agent 5)
//
// Mirrors BE src/types/ai.types.ts (camelCase wire shape).
// JSONB output keys are camelCase. Date/time fields are ISO-8601 strings.
//
// SENSITIVE — never log on the FE:
//   - selectedText (S1 rewrite, S2 explain/rewrite)
//   - chatHistory + draftSummary (S2)
//   - additions / deletions / modifiedClauses (S6)
//   - summaryEn (S4)
//   - signedToken (S5)
//   - ai_prompt_payload (universal — never appears on the FE wire but
//     listed here so future contributors don't add it inadvertently)
// ============================================================

import type { ApiResponse, PaginationMeta } from "@/types/api.types";

// ------------------------------------------------------------
// 1. M4 prompt-id constants (6 in-scope prompts)
// ------------------------------------------------------------

export const M4_PROMPT_IDS = [
  "ai-contract-insights",
  "ai-drafting-assistant",
  "ai-executive-anomalies",
  "ai-regulatory-impact",
  "ai-regulatory-impact-summary",
  "ai-version-diff-summary",
] as const;

export type M4PromptId = (typeof M4_PROMPT_IDS)[number];

// ------------------------------------------------------------
// 2. Shared enums backed by DB CHECK constraints
// ------------------------------------------------------------

export type AiLanguage = "en" | "ar" | "bilingual";
export type AiProvider = "openai" | "anthropic";
export type AiRequestOutcome =
  | "success"
  | "error"
  | "timeout"
  | "rate_limited"
  | "cancelled";

export const AI_REQUEST_OUTCOME_VALUES: readonly AiRequestOutcome[] = [
  "success",
  "error",
  "timeout",
  "rate_limited",
  "cancelled",
];

export type AiContractInsightsMode =
  | "summary"
  | "key_terms"
  | "risks"
  | "obligations"
  | "regulatory"
  | "rewrite";

export const AI_CONTRACT_INSIGHTS_MODES: readonly AiContractInsightsMode[] = [
  "summary",
  "key_terms",
  "risks",
  "obligations",
  "regulatory",
  "rewrite",
];

export type AiDraftingAssistantMode = "suggest" | "explain" | "rewrite" | "chat";
export type AiDraftingAssistantTone =
  | "simpler"
  | "formal"
  | "stronger"
  | "balanced";
export type AiRegulatoryImpactMode = "explain" | "amendment";

export type AiInsightType =
  | "contract_summary"
  | "contract_key_terms"
  | "contract_risks"
  | "contract_obligations"
  | "contract_regulatory"
  | "contract_rewrite"
  | "version_diff_summary"
  | "executive_anomalies"
  | "regulatory_impact_explain"
  | "regulatory_impact_amendment"
  | "regulatory_impact_summary";

export const AI_INSIGHT_TYPE_VALUES: readonly AiInsightType[] = [
  "contract_summary",
  "contract_key_terms",
  "contract_risks",
  "contract_obligations",
  "contract_regulatory",
  "contract_rewrite",
  "version_diff_summary",
  "executive_anomalies",
  "regulatory_impact_explain",
  "regulatory_impact_amendment",
  "regulatory_impact_summary",
];

export type AiInsightEntityType =
  | "contract"
  | "contract_version"
  | "regulatory_update"
  | "regulatory_update_summary"
  | "executive_dashboard";

export const AI_INSIGHT_ENTITY_TYPE_VALUES: readonly AiInsightEntityType[] = [
  "contract",
  "contract_version",
  "regulatory_update",
  "regulatory_update_summary",
  "executive_dashboard",
];

// ------------------------------------------------------------
// 3. ai_prompt entity types
// ------------------------------------------------------------

export interface AiPrompt {
  promptId: M4PromptId | string;
  descriptionEn: string;
  descriptionAr: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTtlSeconds: number;
  supportsStreaming: boolean;
  supportsToolCall: boolean;
  publicEndpoint: boolean;
  promptFilePath: string;
  rateLimitPerUserPerHour: number;
  rateLimitPerUserPerDay: number;
  isActive: boolean;
}

export interface AiPromptListResponse {
  data: AiPrompt[];
  pagination: PaginationMeta;
}

export interface AiPromptListQuery {
  includeInactive?: boolean;
}

// ------------------------------------------------------------
// 4. ai_insight entity types (admin observability)
// ------------------------------------------------------------

export interface AiInsightPayloadBase {
  insightType: AiInsightType;
}

export interface AiContractSummaryPayload extends AiInsightPayloadBase {
  insightType: "contract_summary";
  summary: string;
  riskScore?: number | null;
  language: AiLanguage;
}

export interface AiContractKeyTermsPayload extends AiInsightPayloadBase {
  insightType: "contract_key_terms";
  keyTerms: Array<{
    label: string;
    value: string;
    clauseAnchor?: string | null;
    clauseExcerpt?: string | null;
  }>;
}

export interface AiContractRisksPayload extends AiInsightPayloadBase {
  insightType: "contract_risks";
  risks: Array<{
    title: string;
    severity: "high" | "medium" | "low";
    clauseAnchor: string;
    clauseExcerpt: string;
    rationale: string;
  }>;
}

export interface AiContractObligationsPayload extends AiInsightPayloadBase {
  insightType: "contract_obligations";
  obligations: Array<{
    party: string;
    obligation: string;
    deadline?: string | null;
    clauseAnchor?: string | null;
  }>;
}

export interface AiContractRegulatoryPayload extends AiInsightPayloadBase {
  insightType: "contract_regulatory";
  regulations: Array<{
    citation: string;
    relevance: string;
    clauseAnchor?: string | null;
  }>;
}

export interface AiContractRewritePayload extends AiInsightPayloadBase {
  insightType: "contract_rewrite";
  rewrittenText: string;
}

export interface AiExecutiveAnomaliesPayload extends AiInsightPayloadBase {
  insightType: "executive_anomalies";
  anomalies: Array<{
    insight: string;
    severity: "info" | "warning" | "critical";
    drillDownFilter: string;
  }>;
  generatedAt: string;
}

export interface AiVersionDiffSummaryPayload extends AiInsightPayloadBase {
  insightType: "version_diff_summary";
  summary: string;
}

export interface AiRegulatoryImpactPayload extends AiInsightPayloadBase {
  insightType: "regulatory_impact_explain" | "regulatory_impact_amendment";
  text: string;
}

export interface AiRegulatoryImpactSummaryPayload extends AiInsightPayloadBase {
  insightType: "regulatory_impact_summary";
  executive: string;
  keyChanges: string[];
  recommendedActions: string[];
}

export type AiInsightPayload =
  | AiContractSummaryPayload
  | AiContractKeyTermsPayload
  | AiContractRisksPayload
  | AiContractObligationsPayload
  | AiContractRegulatoryPayload
  | AiContractRewritePayload
  | AiExecutiveAnomaliesPayload
  | AiVersionDiffSummaryPayload
  | AiRegulatoryImpactPayload
  | AiRegulatoryImpactSummaryPayload;

export interface AiInsight {
  id: number;
  entityType: AiInsightEntityType;
  entityId: number | null;
  insightType: AiInsightType;
  language: AiLanguage;
  promptId: M4PromptId | string;
  provider: AiProvider;
  modelUsed: string;
  payload: AiInsightPayload;
  payloadHash: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsdMicros: number | null;
  expiresAt: string;
  createdAt: string;
}

export interface AiInsightListItem extends AiInsight {
  isActive: boolean;
}

export interface AiInsightListResponse {
  data: AiInsightListItem[];
  pagination: PaginationMeta;
}

export interface AiInsightListQuery {
  page?: number;
  limit?: number;
  entityType?: AiInsightEntityType;
  insightType?: AiInsightType;
  language?: AiLanguage;
  provider?: AiProvider;
  includeExpired?: boolean;
}

// ------------------------------------------------------------
// 5. ai_request_log entity types (admin observability)
// ------------------------------------------------------------

export interface AiRequestLogActor {
  id: number;
  email: string;
  fullName: string;
}

export interface AiRequestLogListItem {
  id: number;
  requestId: string;
  promptId: M4PromptId | string;
  mode: string | null;
  actor: AiRequestLogActor | null;
  entityType: AiInsightEntityType | string | null;
  entityId: number | null;
  language: AiLanguage;
  provider: AiProvider;
  modelUsed: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsdMicros: number | null;
  latencyMs: number | null;
  cacheHit: boolean;
  streamMode: boolean;
  outcome: AiRequestOutcome;
  errorClass: string | null;
  /** SENSITIVE — already redacted at write per AC-S10-07; never re-log on FE. */
  errorMessage: string | null;
  createdAt: string;
}

export interface AiRequestLogListResponse {
  data: AiRequestLogListItem[];
  pagination: PaginationMeta;
}

export interface AiRequestLogListQuery {
  page?: number;
  limit?: number;
  actorUserId?: number;
  promptId?: M4PromptId | string;
  outcome?: AiRequestOutcome;
  fromDate?: string;
  toDate?: string;
}

// ------------------------------------------------------------
// 6. AI cost report (S12)
// ------------------------------------------------------------

export interface AiCostReportRow {
  promptId: M4PromptId | string;
  actor?: AiRequestLogActor | null;
  totalCostUsdMicros: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number | null;
  cacheHitRatio: number | null;
}

export interface AiCostReportResponse {
  data: AiCostReportRow[];
}

export interface AiCostReportQuery {
  fromDate: string;
  toDate: string;
  groupByUser?: boolean;
}

// ------------------------------------------------------------
// 7. fn_contract_ai_summary_persist + fn_contract_version_diff_summary_persist
// ------------------------------------------------------------

export interface ContractAiSummaryPersistData {
  contractId: number;
  aiSummaryEn: string | null;
  aiSummaryAr: string | null;
  aiRiskScore: number | null;
  updatedAt: string;
}

export interface ContractVersionDiffSummaryPersistData {
  contractVersionId: number;
  diffSummary: string;
  updatedAt: string;
}

// ============================================================
// 8. Per-prompt SERVICE CONTRACTS (request/response)
// ============================================================

// ----- 8.1 ai-contract-insights (S1) -----

export interface AiContractInsightsRequest {
  contractId: number;
  mode: AiContractInsightsMode;
  language: AiLanguage;
  /** SENSITIVE — required for mode='rewrite'. */
  selectedText?: string;
}

export type AiContractInsightsResponseBody =
  | { mode: "key_terms"; payload: AiContractKeyTermsPayload }
  | { mode: "risks"; payload: AiContractRisksPayload }
  | { mode: "obligations"; payload: AiContractObligationsPayload }
  | { mode: "regulatory"; payload: AiContractRegulatoryPayload };

/** SSE shape for mode='summary' or 'rewrite'. */
export type AiInsightsStreamChunk =
  | { type: "token"; delta: string }
  | {
      type: "done";
      tokensConsumed: number;
      persisted?: ContractAiSummaryPersistData | null;
    }
  | {
      type: "error";
      code: string;
      message?: string;
      retryAfterSeconds?: number;
    };

// ----- 8.2 ai-drafting-assistant (S2) -----

export interface AiDraftingAssistantChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiDraftingAssistantRequest {
  mode: AiDraftingAssistantMode;
  contractType: string;
  partyA: string;
  partyB?: string;
  draftSummary: string;
  existingClauseCategories: string[];
  language: AiLanguage;
  /** SENSITIVE — required for mode='explain' or 'rewrite'. */
  selectedText?: string;
  tone?: AiDraftingAssistantTone;
  /** SENSITIVE — chat history. Last 20 turns x ≤4000 chars. */
  chatHistory?: AiDraftingAssistantChatTurn[];
}

export type AiDraftingAssistantStreamChunk =
  | { type: "token"; delta: string }
  | { type: "done"; tokensConsumed: number }
  | {
      type: "error";
      code: string;
      message?: string;
      retryAfterSeconds?: number;
    };

export interface AiDraftingAssistantSuggestion {
  kind: "missing_clause" | "weak_clause" | "regulatory";
  title: string;
  rationale: string;
  proposedText: string;
}

export interface AiDraftingAssistantSuggestResponse {
  suggestions: AiDraftingAssistantSuggestion[];
}

// ----- 8.3 ai-executive-anomalies (S3) -----

export interface AiExecutiveAnomaliesStats {
  totalActiveValueAed?: number;
  contractsByStatus?: Record<string, number>;
  expiryCliffs?: Array<{ window: string; count: number }>;
  supplierConcentration?: Array<{ supplier: string; share: number }>;
  [key: string]: unknown;
}

export interface AiExecutiveAnomaliesRequest {
  stats: AiExecutiveAnomaliesStats;
  dateRange?: {
    fromDate: string;
    toDate: string;
  };
  language: AiLanguage;
}

export interface AiExecutiveAnomaliesResponse {
  anomalies: AiExecutiveAnomaliesPayload["anomalies"];
  generatedAt: string;
}

// ----- 8.4 ai-regulatory-impact (S4) -----

export interface AiRegulatoryImpactSampleContract {
  contractNumber: string;
  titleEn: string;
  contractType: string;
  valueAed?: number | null;
}

export interface AiRegulatoryImpactRequest {
  mode: AiRegulatoryImpactMode;
  regulator: string;
  referenceNumber?: string;
  titleEn: string;
  /** SENSITIVE. */
  summaryEn?: string;
  effectiveDate?: string;
  complianceDeadline?: string;
  affectedClauseCategories: string[];
  impactedCount?: number;
  sampleContracts: AiRegulatoryImpactSampleContract[];
  language: AiLanguage;
  impactCategoryName?: string;
  impactCategoryGuidance?: string;
}

export type AiRegulatoryImpactStreamChunk =
  | { type: "token"; delta: string }
  | { type: "done"; tokensConsumed: number }
  | {
      type: "error";
      code: string;
      message?: string;
      retryAfterSeconds?: number;
    };

// ----- 8.5 ai-version-diff-summary (S6) -----

export interface AiVersionDiffSummaryRequest {
  contractId: number;
  leftVersionId: number;
  rightVersionId: number;
  /** SENSITIVE. */
  additions: string;
  /** SENSITIVE. */
  deletions: string;
  /** SENSITIVE — clause names + before/after. */
  modifiedClauses: Array<{ clauseName: string; before?: string; after?: string }>;
  language: AiLanguage;
}

export interface AiVersionDiffSummaryResponse {
  summary: string;
  persisted: ContractVersionDiffSummaryPersistData;
  cacheHit: boolean;
}

// ============================================================
// 9. RESPONSE ENVELOPES
// ============================================================

export type AiPromptListEnvelope = ApiResponse<AiPromptListResponse>;
export type AiInsightListEnvelope = ApiResponse<AiInsightListResponse>;
export type AiRequestLogListEnvelope = ApiResponse<AiRequestLogListResponse>;
export type AiCostReportEnvelope = ApiResponse<AiCostReportResponse>;

export type AiContractInsightsResponse = ApiResponse<AiContractInsightsResponseBody>;
export type AiDraftingAssistantSuggestEnvelope =
  ApiResponse<AiDraftingAssistantSuggestResponse>;
export type AiExecutiveAnomaliesEnvelope =
  ApiResponse<AiExecutiveAnomaliesResponse>;
export type AiVersionDiffSummaryEnvelope =
  ApiResponse<AiVersionDiffSummaryResponse>;
