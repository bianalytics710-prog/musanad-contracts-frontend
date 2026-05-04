/**
 * Musanad — Admin / Approval Matrix API service (M2).
 *
 * Thin axios wrappers over /api/v1/admin/approval-matrix endpoints.
 * Permission gates: approval.matrix.read / approval.matrix.write.
 *
 *   - GET  /api/v1/admin/approval-matrix     (S4)
 *   - PUT  /api/v1/admin/approval-matrix     (S5 — upsert/replace)
 */

import { apiClient } from "@/lib/api-client";
import type {
  ApprovalMatrixListQuery,
  ApprovalMatrixListResponse,
  ApprovalMatrixSetResponse,
  UpdateApprovalMatrixDto,
} from "@/types/entities/approval.types";

const BASE = "/api/v1/admin/approval-matrix";

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

export const approvalMatrixService = {
  /** S4 — GET /api/v1/admin/approval-matrix. */
  list: async (
    query: ApprovalMatrixListQuery = {},
  ): Promise<ApprovalMatrixListResponse> => {
    const { data } = await apiClient.get<ApprovalMatrixListResponse>(BASE, {
      params: toParams(query),
    });
    return data;
  },

  /**
   * S5 — PUT /api/v1/admin/approval-matrix.
   *
   * Upsert/replace semantics: soft-deletes existing active rules for the
   * (contractType, valueMin, valueMax) tuple and INSERTs the new rules.
   * Idempotent — same body re-saves to the same end state.
   */
  set: async (
    payload: UpdateApprovalMatrixDto,
  ): Promise<ApprovalMatrixSetResponse> => {
    const { data } = await apiClient.put<ApprovalMatrixSetResponse>(BASE, payload);
    return data;
  },
};

export default approvalMatrixService;
