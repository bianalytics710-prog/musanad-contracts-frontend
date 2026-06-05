/**
 * Executive Risk Review service — Phase C.
 *
 *   GET  /api/v1/dashboards/executive/risk-review        list
 *   POST /api/v1/risk-cases/:id/promote                  promote one
 *   POST /api/v1/risk-cases/:id/dismiss-as-noise         dismiss one
 *   POST /api/v1/risk-cases/risk-review/bulk             bulk action
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

export interface RiskReviewListResponse {
  asOf: string;
  rows: RiskReviewRow[];
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

  promote: async (caseId: number): Promise<void> => {
    await apiClient.post(`/api/v1/risk-cases/${caseId}/promote`);
  },

  dismiss: async (caseId: number): Promise<void> => {
    await apiClient.post(`/api/v1/risk-cases/${caseId}/dismiss-as-noise`);
  },

  bulk: async (action: 'promote' | 'dismiss', caseIds: number[]): Promise<void> => {
    await apiClient.post(`/api/v1/risk-cases/risk-review/bulk`, { action, caseIds });
  },
};
