/**
 * M14 / CR-F — Admin Scoring Weights Service.
 *
 * A7 compliance: all HTTP calls go through this service.
 * Wraps:
 *   GET   /api/v1/admin/scoring-weights
 *   PATCH /api/v1/admin/scoring-weights
 *   POST  /api/v1/admin/scoring-weights/recompute-all
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  ScoringWeightsGetResponse,
  ScoringWeightsSetResponse,
  ScoringWeightsUpdateRequest,
  ScoreRecomputeForWeightChangeResult,
} from '@/types/entities/risk-score.types';

export const adminScoringWeightsService = {
  /**
   * GET /api/v1/admin/scoring-weights
   * Returns current weights config + version history + exposure defaults.
   * Gated: score.weights.manage
   */
  getScoringWeights: async (): Promise<ScoringWeightsGetResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: ScoringWeightsGetResponse }>(
      '/api/v1/admin/scoring-weights',
    );
    return unwrap<ScoringWeightsGetResponse>(data);
  },

  /**
   * PATCH /api/v1/admin/scoring-weights
   * Saves new scoring weights. Bumps version monotonically.
   * Gated: score.weights.manage
   */
  updateScoringWeights: async (
    weights: ScoringWeightsUpdateRequest,
  ): Promise<ScoringWeightsSetResponse> => {
    const { data } = await apiClient.patch<{ success: boolean; data: ScoringWeightsSetResponse }>(
      '/api/v1/admin/scoring-weights',
      weights,
    );
    return unwrap<ScoringWeightsSetResponse>(data);
  },

  /**
   * POST /api/v1/admin/scoring-weights/recompute-all
   * Triggers bulk recompute of all active contracts with current weights.
   * Gated: score.weights.manage
   */
  recomputeAllScores: async (): Promise<ScoreRecomputeForWeightChangeResult> => {
    const { data } = await apiClient.post<{
      success: boolean;
      data: ScoreRecomputeForWeightChangeResult;
    }>('/api/v1/admin/scoring-weights/recompute-all');
    return unwrap<ScoreRecomputeForWeightChangeResult>(data);
  },
};
