/**
 * M14 / CR-F — Risk Score Service.
 *
 * A7 compliance: all HTTP calls go through this service.
 * Wraps:
 *   GET  /api/v1/contracts/:id/risk-score
 *   GET  /api/v1/contracts/:id/risk-score/history
 *   GET  /api/v1/risk/avar
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  RiskScoreExplainResponse,
  RiskScoreHistoryResponse,
  AvarAggregateResponse,
  AvarFilters,
} from '@/types/entities/risk-score.types';

export const riskScoreService = {
  /**
   * GET /api/v1/contracts/:id/risk-score
   * Returns the latest risk_score snapshot with hydrated correlations.
   * Gated: score.read
   */
  getRiskScore: async (contractId: number | string): Promise<RiskScoreExplainResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: RiskScoreExplainResponse }>(
      `/api/v1/contracts/${contractId}/risk-score`,
    );
    return unwrap<RiskScoreExplainResponse>(data);
  },

  /**
   * GET /api/v1/contracts/:id/risk-score/history?windowDays=N
   * Returns score history snapshots for 30 / 90 / 180-day windows.
   * Gated: score.read
   */
  getRiskScoreHistory: async (
    contractId: number | string,
    windowDays: 30 | 90 | 180 = 90,
  ): Promise<RiskScoreHistoryResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: RiskScoreHistoryResponse }>(
      `/api/v1/contracts/${contractId}/risk-score/history`,
      { params: { windowDays } },
    );
    return unwrap<RiskScoreHistoryResponse>(data);
  },

  /**
   * GET /api/v1/risk/avar
   * Aggregates MaR across latest_risk_score for the tenant.
   * Gated: score.read
   */
  getAvar: async (filters: AvarFilters = {}): Promise<AvarAggregateResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: AvarAggregateResponse }>(
      '/api/v1/risk/avar',
      { params: filters },
    );
    return unwrap<AvarAggregateResponse>(data);
  },
};
