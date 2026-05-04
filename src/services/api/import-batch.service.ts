/**
 * Musanad — Import Batches API service (M1c).
 *
 * Thin axios wrappers over /api/v1/import-batches*. Paths and shapes derived
 * directly from .claude/workspace/current-module/api-contracts.json.
 *
 * 4 endpoints across stories S1..S4. The S8 AI stub lives in a sibling
 * service (extract-contract-bulk.service.ts) under /api/v1/ai/*.
 *
 * The api-client interceptor handles JWT, X-Request-ID, refresh-token
 * rotation, and error normalisation (ApiError) — these methods only own
 * the request/response wire shapes (F-FE-001 — never raw fetch).
 */

import { apiClient } from "@/lib/api-client";
import type {
  CreateImportBatchDto,
  CreateImportBatchResponse,
  ImportBatch,
  ImportBatchListQuery,
  ImportBatchListResponse,
  UpdateImportBatchDto,
  UpdateImportBatchResponse,
} from "@/types/entities/import-batch.types";

const BASE = "/api/v1/import-batches";

/** Strip undefined / empty-string values so axios serialises a clean URL. */
function toParams(q: object | undefined): Record<string, unknown> {
  if (!q) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

export const importBatchService = {
  // S1 — POST /api/v1/import-batches
  create: async (
    payload: CreateImportBatchDto,
  ): Promise<CreateImportBatchResponse> => {
    const { data } = await apiClient.post<CreateImportBatchResponse>(
      BASE,
      payload,
    );
    return data;
  },

  // S2 — PATCH /api/v1/import-batches/:id
  update: async (
    id: number,
    payload: UpdateImportBatchDto,
  ): Promise<UpdateImportBatchResponse> => {
    const { data } = await apiClient.patch<UpdateImportBatchResponse>(
      `${BASE}/${id}`,
      payload,
    );
    return data;
  },

  // S3 — GET /api/v1/import-batches
  list: async (
    query: ImportBatchListQuery = {},
  ): Promise<ImportBatchListResponse> => {
    const { data } = await apiClient.get<ImportBatchListResponse>(BASE, {
      params: toParams(query),
    });
    return data;
  },

  // S4 — GET /api/v1/import-batches/:id
  getById: async (id: number): Promise<ImportBatch> => {
    const { data } = await apiClient.get<ImportBatch>(`${BASE}/${id}`);
    return data;
  },
};

export default importBatchService;
