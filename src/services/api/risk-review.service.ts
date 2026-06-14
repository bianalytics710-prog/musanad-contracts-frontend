/**
 * Executive Risk Review service — Phase C + Phase E.
 *
 *   GET  /api/v1/dashboards/executive/risk-review                    list (Tier-2)
 *   GET  /api/v1/dashboards/executive/risk-triage/tier1              list (Tier-1)
 *   GET  /api/v1/dashboards/executive/risk-triage/assignee-suggest   dropdown options
 *   POST /api/v1/risk-cases/:id/promote          { assignedUserId? } promote one
 *   POST /api/v1/risk-cases/:id/dismiss-as-noise                     dismiss one
 *   POST /api/v1/risk-cases/:id/reassign         { newUserId }       reassign Tier-1
 *   POST /api/v1/risk-cases/risk-review/bulk                         bulk action
 */
import { apiClient } from '@/lib/api-client';

export interface RiskReviewRow {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  suppressed_reason: string | null;
  confidence: number;
  materiality_aed: number;
  risk_type: string;
  contract_id: string | null;
  contract_number: string | null;
  contract_title: string | null;
  counterparty_name: string | null;
  value_aed: number | null;
  currency: string | null;
  created_at: string;
  impact_score: number;
  /**
   * Routing matrix preview — the role this case WOULD be assigned to if
   * promoted. Computed server-side using the same first-match logic as
   * fn_risk_case_classify_and_route so the modal preview matches what
   * promote actually produces. NULL when no rule matches (the case stays
   * unassigned and lands in Operations via the catch-all only).
   */
  preview_role: string | null;
  preview_role_display: string | null;
  preview_sla_hours: number | null;
}

/**
 * Phase E.3 — Tier-1 oversight row. Includes the current owner display
 * fields so the executive can decide whether to reassign or dismiss.
 */
export interface RiskTriageTier1Row {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  confidence: number;
  materiality_aed: number;
  risk_type: string;
  contract_id: string | null;
  contract_number: string | null;
  contract_title: string | null;
  counterparty_name: string | null;
  value_aed: number | null;
  currency: string | null;
  created_at: string;
  assigned_role: string;
  assigned_user_id: string;
  assigned_user_name: string | null;
  assigned_user_email: string | null;
  sla_hours: number | null;
  due_at: string | null;
}

export interface RiskReviewListResponse {
  asOf: string;
  rows: RiskReviewRow[];
}

export interface RiskTriageTier1Response {
  asOf: string;
  rows: RiskTriageTier1Row[];
}

/** Phase E.1 — one row from fn_risk_review_assignee_suggest. */
export interface AssigneeSuggestion {
  id: string;
  name: string;
  email: string;
  roleName: string;
  openCases: number;
  suggested: boolean;
}

export interface AssigneeSuggestResponse {
  role: string;
  rows: AssigneeSuggestion[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export const riskReviewService = {
  list: async (limit = 10): Promise<RiskReviewListResponse> => {
    const res = await apiClient.get<Envelope<RiskReviewListResponse>>(
      `/api/v1/dashboards/executive/risk-review`,
      { params: { limit } },
    );
    return res.data.data;
  },

  /** Phase E.3 — Tier-1 oversight list. */
  tier1List: async (limit = 25): Promise<RiskTriageTier1Response> => {
    const res = await apiClient.get<Envelope<RiskTriageTier1Response>>(
      `/api/v1/dashboards/executive/risk-triage/tier1`,
      { params: { limit } },
    );
    return res.data.data;
  },

  /** Phase E.1 — dropdown options for a given role. */
  assigneeSuggest: async (role: string): Promise<AssigneeSuggestResponse> => {
    const res = await apiClient.get<Envelope<AssigneeSuggestResponse>>(
      `/api/v1/dashboards/executive/risk-triage/assignee-suggest`,
      { params: { role } },
    );
    return res.data.data;
  },

  /**
   * Phase E.2 — promote (optionally pin assignedUserId). When NULL the BE
   * falls back to role-only routing (legacy Phase C behaviour).
   */
  promote: async (caseId: number, assignedUserId: number | null = null): Promise<void> => {
    await apiClient.post(`/api/v1/risk-cases/${caseId}/promote`,
      assignedUserId !== null ? { assignedUserId } : {});
  },

  dismiss: async (caseId: number): Promise<void> => {
    await apiClient.post(`/api/v1/risk-cases/${caseId}/dismiss-as-noise`);
  },

  /** Phase E.4 — executive reassign override (status='open' only). */
  reassign: async (caseId: number, newUserId: number): Promise<void> => {
    await apiClient.post(`/api/v1/risk-cases/${caseId}/reassign`, { newUserId });
  },

  bulk: async (action: 'promote' | 'dismiss', caseIds: number[]): Promise<void> => {
    await apiClient.post(`/api/v1/risk-cases/risk-review/bulk`, { action, caseIds });
  },
};
