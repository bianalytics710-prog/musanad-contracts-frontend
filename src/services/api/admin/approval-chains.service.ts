/**
 * Musanad — Admin / Approval Chains + Steps API service (M2).
 *
 * Thin axios wrappers over /api/v1/admin/approval-chains and
 * /api/v1/admin/approval-steps/:stepId/reassign. Permission gates:
 * approval.matrix.read OR approval.reassign (S11), approval.reassign (S8).
 *
 *   - GET  /api/v1/admin/approval-chains                       (S11)
 *   - POST /api/v1/admin/approval-steps/:stepId/reassign       (S8)
 */

import { apiClient } from "@/lib/api-client";
import type {
  ApprovalChainListQuery,
  ApprovalChainListResponse,
  ReassignApprovalDto,
  ReassignApprovalResponse,
} from "@/types/entities/approval.types";

const CHAINS_BASE = "/api/v1/admin/approval-chains";
const STEPS_BASE = "/api/v1/admin/approval-steps";

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

export const approvalChainsService = {
  /** S11 — GET /api/v1/admin/approval-chains. */
  list: async (
    query: ApprovalChainListQuery = {},
  ): Promise<ApprovalChainListResponse> => {
    const { data } = await apiClient.get<ApprovalChainListResponse>(CHAINS_BASE, {
      params: toParams(query),
    });
    return data;
  },

  /** S8 — POST /api/v1/admin/approval-steps/:stepId/reassign. */
  reassign: async (
    stepId: number,
    payload: ReassignApprovalDto,
  ): Promise<ReassignApprovalResponse> => {
    const { data } = await apiClient.post<ReassignApprovalResponse>(
      `${STEPS_BASE}/${stepId}/reassign`,
      payload,
    );
    return data;
  },
};

export default approvalChainsService;
