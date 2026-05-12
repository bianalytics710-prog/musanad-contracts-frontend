/**
 * M13 / CR-E — Correlations Service.
 *
 * A7 compliance: all HTTP calls go through this service.
 * Wraps:
 *   GET  /api/v1/correlations
 *   POST /api/v1/correlations/:id/dismiss
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  CorrelationListResponse,
  CorrelationDismissRequest,
  CorrelationDismissResult,
  CorrelationStatus,
} from '@/types/entities/rule.types';

export interface CorrelationListParams {
  page?: number;
  limit?: number;
  contractId?: number;
  status?: CorrelationStatus;
  ruleId?: string;
  fromDate?: string;
  toDate?: string;
}

export const correlationsService = {
  /**
   * GET /api/v1/correlations
   * Paginated list of correlations. Gated: correlation.read.
   */
  list: async (params: CorrelationListParams = {}): Promise<CorrelationListResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: CorrelationListResponse }>(
      '/api/v1/correlations',
      { params },
    );
    return unwrap<CorrelationListResponse>(data);
  },

  /**
   * POST /api/v1/correlations/:id/dismiss
   * Dismiss an active correlation with mandatory reason. Gated: correlation.dismiss.
   */
  dismiss: async (
    id: number,
    payload: CorrelationDismissRequest,
  ): Promise<CorrelationDismissResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: CorrelationDismissResult }>(
      `/api/v1/correlations/${id}/dismiss`,
      payload,
    );
    return unwrap<CorrelationDismissResult>(data);
  },
};
