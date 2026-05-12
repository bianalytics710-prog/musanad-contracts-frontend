/**
 * M12 / CR-D — Clause Extraction Service.
 *
 * A7 compliance: all HTTP calls go through this service.
 * Wraps:
 *   POST /api/v1/contracts/:id/extract-clauses
 *   POST /api/v1/contracts/:id/versions/:vId/extract-clauses
 *   GET  /api/v1/clauses/review-queue
 *   POST /api/v1/clauses/:id/review
 *   POST /api/v1/clauses/search
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  ClauseExtractionRequestResult,
  ClauseReviewQueueListResponse,
  ClauseReviewResolveRequest,
  ClauseReviewResolveResult,
  ClauseSemanticSearchRequest,
  ClauseSemanticSearchResponse,
  ClauseReviewStatus,
} from '@/types/entities/clause.types';

export interface ClauseReviewQueueListParams {
  page?: number;
  limit?: number;
  contractId?: number;
  clauseType?: string;
  reviewStatus?: ClauseReviewStatus;
  confidenceBelow?: number;
  search?: string;
}

export const clauseExtractionService = {
  /**
   * POST /api/v1/contracts/:id/extract-clauses
   * Manual trigger on the latest version. Gated: clause.extract (Super Admin).
   */
  triggerExtraction: async (
    contractId: number,
    forceReprocess?: boolean,
  ): Promise<ClauseExtractionRequestResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: ClauseExtractionRequestResult }>(
      `/api/v1/contracts/${contractId}/extract-clauses`,
      { forceReprocess },
    );
    return unwrap<ClauseExtractionRequestResult>(data);
  },

  /**
   * POST /api/v1/contracts/:id/versions/:vId/extract-clauses
   * Trigger on a specific version. Gated: clause.extract (Super Admin).
   */
  triggerExtractionForVersion: async (
    contractId: number,
    versionId: number,
    forceReprocess?: boolean,
  ): Promise<ClauseExtractionRequestResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: ClauseExtractionRequestResult }>(
      `/api/v1/contracts/${contractId}/versions/${versionId}/extract-clauses`,
      { forceReprocess },
    );
    return unwrap<ClauseExtractionRequestResult>(data);
  },

  /**
   * GET /api/v1/clauses/review-queue
   * Paginated review queue. Gated: clause.review (legal_counsel, platform_admin).
   */
  listReviewQueue: async (
    params: ClauseReviewQueueListParams = {},
  ): Promise<ClauseReviewQueueListResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: ClauseReviewQueueListResponse }>(
      '/api/v1/clauses/review-queue',
      { params },
    );
    return unwrap<ClauseReviewQueueListResponse>(data);
  },

  /**
   * POST /api/v1/clauses/:id/review
   * Confirm / correct / reject an extracted clause. Gated: clause.review.
   */
  resolveReview: async (
    clauseId: number,
    payload: ClauseReviewResolveRequest,
  ): Promise<ClauseReviewResolveResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: ClauseReviewResolveResult }>(
      `/api/v1/clauses/${clauseId}/review`,
      payload,
    );
    return unwrap<ClauseReviewResolveResult>(data);
  },

  /**
   * POST /api/v1/clauses/search
   * Semantic search via pgvector. Gated: clause.search (all contract-readers).
   */
  semanticSearch: async (
    payload: ClauseSemanticSearchRequest,
  ): Promise<ClauseSemanticSearchResponse> => {
    const { data } = await apiClient.post<{ success: boolean; data: ClauseSemanticSearchResponse }>(
      '/api/v1/clauses/search',
      payload,
    );
    return unwrap<ClauseSemanticSearchResponse>(data);
  },
};
