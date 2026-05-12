/**
 * M11 — Admin Ingestion Queue service.
 *
 * Pattern: apiClient.<method><T>(...) then `return data` — matches M10 pattern.
 * A7 compliance: all HTTP calls go through this service.
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  AdminIngestionQueueListQuery,
  IngestionReviewQueueListResponse,
  IngestionResolveRequest,
  IngestionResolveResult,
} from '@/types/admin/ingestion-queue.types';

export const adminIngestionQueueService = {
  /**
   * GET /api/v1/admin/ingestion-queue
   * Paginated list with optional filters.
   */
  list: async (
    params: AdminIngestionQueueListQuery = {},
  ): Promise<IngestionReviewQueueListResponse> => {
    const { data } = await apiClient.get<IngestionReviewQueueListResponse>(
      '/api/v1/admin/ingestion-queue',
      { params },
    );
    return data;
  },

  /**
   * POST /api/v1/admin/ingestion-queue/:id/resolve
   * Confirm / correct / reject a review-queue row.
   * Returns 409 when row already resolved/rejected.
   */
  resolve: async (
    queueId: number,
    payload: IngestionResolveRequest,
  ): Promise<IngestionResolveResult> => {
    const { data } = await apiClient.post<IngestionResolveResult>(
      `/api/v1/admin/ingestion-queue/${queueId}/resolve`,
      payload,
    );
    return unwrap<IngestionResolveResult>(data);
  },
};
