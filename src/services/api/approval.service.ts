/**
 * Musanad — Approvals API service (M2).
 *
 * Thin axios wrappers over /api/v1/approvals/* and the per-contract
 * approval-chain sub-endpoints. Paths and shapes derived directly from
 * .claude/workspace/current-module/api-contracts.json.
 *
 * Endpoints:
 *   - GET  /api/v1/approvals/my-pending                      (S1)
 *   - POST /api/v1/approvals/:stepId/decide                  (S2)
 *   - POST /api/v1/approvals/:stepId/delegate                (S3)
 *   - GET  /api/v1/contracts/:id/approval-chain              (S10)
 *   - POST /api/v1/contracts/:id/approval-chain/preview      (S6)
 *   - POST /api/v1/contracts/:id/submit-for-approval         (S7)
 *
 * The api-client interceptor handles JWT + X-Request-ID + 401-refresh +
 * error normalisation (ApiError). These methods only own the wire shapes.
 *
 * SENSITIVE: decisionNote MUST never be console.logged (T13) — pino
 * redaction handles the BE side.
 */

import { apiClient } from "@/lib/api-client";
import type {
  ApprovalChainGetResponse,
  DecideApprovalDto,
  DecideApprovalResponse,
  DelegateApprovalDto,
  DelegateApprovalResponse,
  MyPendingApprovalListQuery,
  MyPendingApprovalListResponse,
  RouteInitPreviewRequest,
  RouteInitPreviewResponse,
  SubmitForApprovalRequest,
  SubmitForApprovalResponse,
} from "@/types/entities/approval.types";

const APPROVALS_BASE = "/api/v1/approvals";
const CONTRACTS_BASE = "/api/v1/contracts";

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

export const approvalService = {
  /** S1 — GET /api/v1/approvals/my-pending. */
  myPending: async (
    query: MyPendingApprovalListQuery = {},
  ): Promise<MyPendingApprovalListResponse> => {
    const { data } = await apiClient.get<MyPendingApprovalListResponse>(
      `${APPROVALS_BASE}/my-pending`,
      { params: toParams(query) },
    );
    return data;
  },

  /** S2 — POST /api/v1/approvals/:stepId/decide. */
  decide: async (
    stepId: number,
    payload: DecideApprovalDto,
  ): Promise<DecideApprovalResponse> => {
    const { data } = await apiClient.post<DecideApprovalResponse>(
      `${APPROVALS_BASE}/${stepId}/decide`,
      payload,
    );
    return data;
  },

  /** S3 — POST /api/v1/approvals/:stepId/delegate. */
  delegate: async (
    stepId: number,
    payload: DelegateApprovalDto,
  ): Promise<DelegateApprovalResponse> => {
    const { data } = await apiClient.post<DelegateApprovalResponse>(
      `${APPROVALS_BASE}/${stepId}/delegate`,
      payload,
    );
    return data;
  },

  /** S10 — GET /api/v1/contracts/:id/approval-chain. */
  getChainByContractId: async (
    contractId: number,
  ): Promise<ApprovalChainGetResponse> => {
    const { data } = await apiClient.get<ApprovalChainGetResponse>(
      `${CONTRACTS_BASE}/${contractId}/approval-chain`,
    );
    return data;
  },

  /** S6 — POST /api/v1/contracts/:id/approval-chain/preview. */
  previewChain: async (
    contractId: number,
    payload: RouteInitPreviewRequest,
  ): Promise<RouteInitPreviewResponse> => {
    const { data } = await apiClient.post<RouteInitPreviewResponse>(
      `${CONTRACTS_BASE}/${contractId}/approval-chain/preview`,
      payload,
    );
    return data;
  },

  /** S7 — POST /api/v1/contracts/:id/submit-for-approval. */
  submitForApproval: async (
    contractId: number,
    payload: SubmitForApprovalRequest = {} as SubmitForApprovalRequest,
  ): Promise<SubmitForApprovalResponse> => {
    const { data } = await apiClient.post<SubmitForApprovalResponse>(
      `${CONTRACTS_BASE}/${contractId}/submit-for-approval`,
      payload,
    );
    return data;
  },
};

export default approvalService;
