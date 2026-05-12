/**
 * M11 — Document Ingestion Pipeline — FE service.
 *
 * Pattern: apiClient.<method><T>(...) then `return data` (NOT return data.data).
 * This matches the M10 admin-audit.service.ts pattern.
 *
 * A7 compliance: all HTTP calls go through this service — NO direct apiClient
 * imports in pages / components / hooks.
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  IngestionQueuedResponse,
  IngestionStatusResponse,
  SignedExtractedTextUrlResponse,
} from '@/types/document-ingestion.types';

export const documentIngestionService = {
  /**
   * POST /api/v1/contracts/:id/versions/:vId/ingest
   * Manual trigger to (re-)queue extraction. document.ingest permission.
   * Idempotent — returns alreadyInProgress=true if already extracting/complete.
   */
  manualIngest: async (
    contractId: number,
    versionId: number,
  ): Promise<IngestionQueuedResponse> => {
    const { data } = await apiClient.post<IngestionQueuedResponse>(
      `/api/v1/contracts/${contractId}/versions/${versionId}/ingest`,
    );
    return unwrap<IngestionQueuedResponse>(data);
  },

  /**
   * GET /api/v1/contracts/:id/versions/:vId/ingestion-status
   * Returns current ingestion status for polling (refetchInterval driven).
   * 404 → caller receives ApiError with status 404.
   */
  getIngestionStatus: async (
    contractId: number,
    versionId: number,
  ): Promise<IngestionStatusResponse> => {
    const { data } = await apiClient.get<IngestionStatusResponse>(
      `/api/v1/contracts/${contractId}/versions/${versionId}/ingestion-status`,
    );
    return unwrap<IngestionStatusResponse>(data);
  },

  /**
   * GET /api/v1/contracts/:id/versions/:vId/extracted-text
   * Returns a signed Supabase Storage URL (60-second TTL).
   * 409 when extraction not yet complete.
   */
  getExtractedTextSignedUrl: async (
    contractId: number,
    versionId: number,
  ): Promise<SignedExtractedTextUrlResponse> => {
    const { data } = await apiClient.get<SignedExtractedTextUrlResponse>(
      `/api/v1/contracts/${contractId}/versions/${versionId}/extracted-text`,
    );
    return unwrap<SignedExtractedTextUrlResponse>(data);
  },
};
