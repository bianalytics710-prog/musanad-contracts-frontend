/**
 * M15 / CR-G — AI Risk Assistant type definitions.
 *
 * Mirrors Agent 5 types.ts §1 (AI Risk Assistant).
 * Used by RiskAssistantPanel + risk-assistant.service.
 */

// ─── Request ──────────────────────────────────────────────────────────────────

export type RiskAssistantPersona =
  | 'executive'
  | 'legal_counsel'
  | 'compliance_esg'
  | 'operations'
  | 'finance_treasury'
  | 'procurement';

export interface AvarFilters {
  contractIds?: string[];
  contractType?: string;
  emirate?: string;
  riskKind?: string;
}

export interface RiskAssistantAskRequest {
  /** Free-text natural-language question (max 2000 chars). SENSITIVE. */
  query: string;
  persona?: RiskAssistantPersona;
  filters?: AvarFilters;
}

// ─── SSE event shapes ─────────────────────────────────────────────────────────

export interface RiskAssistantCitation {
  type: 'clause' | 'correlation' | 'signal' | 'contract';
  id: string;
  label: string;
  href: string;
  excerpt?: string;
}

export interface RiskAssistantSSEEvent {
  event: 'token' | 'citation' | 'done' | 'error';
  data: {
    token?: string;
    citation?: RiskAssistantCitation;
    error?: string;
    requestLogId?: string;
  };
}

// ─── Chat message shapes (local FE state) ────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: RiskAssistantCitation[];
  timestamp: string;
  isStreaming?: boolean;
}

// ─── Non-streaming fallback ───────────────────────────────────────────────────

export interface RiskAssistantNonStreamingResponse {
  answer: string;
  citations: RiskAssistantCitation[];
}
