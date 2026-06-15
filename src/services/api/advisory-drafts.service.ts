/**
 * Advisory Drafts service.
 * Wraps GET  /api/v1/advisory-drafts
 *       GET  /api/v1/advisory-drafts/:id
 *       POST /api/v1/advisory-drafts/generate
 *       POST /api/v1/advisory-drafts/:id/modify
 *       POST /api/v1/advisory-drafts/:id/approve
 *       POST /api/v1/advisory-drafts/:id/reject
 *       POST /api/v1/advisory-drafts/:id/dispatch
 *       GET  /api/v1/advisory-drafts/:id/dispatch-log
 *
 * A7 compliance: all HTTP calls go through apiClient here — never in pages/components.
 */
import { apiClient } from '@/lib/api-client';
import type {
  ListAdvisoryDraftsResponse,
  AdvisoryDraft,
  GenerateAdvisoryDraftDto,
  GenerateAdvisoryDraftResponse,
  ApproveAdvisoryDraftDto,
  ApproveAdvisoryDraftResponse,
  RejectAdvisoryDraftDto,
  RejectAdvisoryDraftResponse,
  ModifyAdvisoryDraftDto,
  ModifyAdvisoryDraftResponse,
  DispatchAdvisoryDraftDto,
  DispatchAdvisoryDraftResponse,
  AdvisoryDispatchLogResponse,
  ListAdvisoryDraftsParams,
} from '@/types/advisory-drafts.types';

export const advisoryDraftsService = {
  list: async (
    params: ListAdvisoryDraftsParams = {},
  ): Promise<ListAdvisoryDraftsResponse> => {
    const { data } = await apiClient.get<ListAdvisoryDraftsResponse>(
      '/api/v1/advisory-drafts',
      { params },
    );
    return data;
  },

  getById: async (id: number): Promise<AdvisoryDraft> => {
    const { data } = await apiClient.get<AdvisoryDraft>(
      `/api/v1/advisory-drafts/${id}`,
    );
    return data;
  },

  generate: async (
    payload: GenerateAdvisoryDraftDto,
  ): Promise<GenerateAdvisoryDraftResponse> => {
    const { data } = await apiClient.post<GenerateAdvisoryDraftResponse>(
      '/api/v1/advisory-drafts/generate',
      payload,
    );
    return data;
  },

  modify: async (
    id: number,
    payload: ModifyAdvisoryDraftDto,
  ): Promise<ModifyAdvisoryDraftResponse> => {
    const { data } = await apiClient.post<ModifyAdvisoryDraftResponse>(
      `/api/v1/advisory-drafts/${id}/modify`,
      payload,
    );
    return data;
  },

  approve: async (
    id: number,
    payload: ApproveAdvisoryDraftDto = {},
  ): Promise<ApproveAdvisoryDraftResponse> => {
    const { data } = await apiClient.post<ApproveAdvisoryDraftResponse>(
      `/api/v1/advisory-drafts/${id}/approve`,
      payload,
    );
    return data;
  },

  reject: async (
    id: number,
    payload: RejectAdvisoryDraftDto,
  ): Promise<RejectAdvisoryDraftResponse> => {
    const { data } = await apiClient.post<RejectAdvisoryDraftResponse>(
      `/api/v1/advisory-drafts/${id}/reject`,
      payload,
    );
    return data;
  },

  dispatch: async (
    id: number,
    payload: DispatchAdvisoryDraftDto,
  ): Promise<DispatchAdvisoryDraftResponse> => {
    const { data } = await apiClient.post<DispatchAdvisoryDraftResponse>(
      `/api/v1/advisory-drafts/${id}/dispatch`,
      payload,
    );
    return data;
  },

  getDispatchLog: async (id: number): Promise<AdvisoryDispatchLogResponse> => {
    const { data } = await apiClient.get<AdvisoryDispatchLogResponse>(
      `/api/v1/advisory-drafts/${id}/dispatch-log`,
    );
    return data;
  },

  // ─── 2026-06-14 — Risk-case → contract → draft workflow ───────────────
  generateFromRiskCase: async (payload: {
    templateId: number;
    contractId: number;
    riskCaseId?: number | null;
    reviewPath: 'send_directly' | 'executive_review';
    templateContext?: Record<string, unknown>;
  }): Promise<GenerateFromRiskCaseResponse> => {
    const { data } = await apiClient.post<GenerateFromRiskCaseResponse>(
      `/api/v1/advisory-drafts/from-risk-case`,
      payload,
    );
    return data;
  },

  sendDirectly: async (id: number, payload: SendPayload): Promise<DispatchResponse> => {
    const { data } = await apiClient.post<DispatchResponse>(
      `/api/v1/advisory-drafts/${id}/send-directly`,
      payload,
    );
    return data;
  },

  routeForReview: async (id: number): Promise<RouteForReviewResponse> => {
    const { data } = await apiClient.post<RouteForReviewResponse>(
      `/api/v1/advisory-drafts/${id}/route-for-review`,
    );
    return data;
  },

  execApprove: async (id: number): Promise<ExecApproveResponse> => {
    const { data } = await apiClient.post<ExecApproveResponse>(
      `/api/v1/advisory-drafts/${id}/exec-approve`,
    );
    return data;
  },

  sendAfterReview: async (id: number, payload: SendPayload): Promise<DispatchResponse> => {
    const { data } = await apiClient.post<DispatchResponse>(
      `/api/v1/advisory-drafts/${id}/send-after-review`,
      payload,
    );
    return data;
  },

  resend: async (id: number, payload: SendPayload): Promise<DispatchResponse> => {
    const { data } = await apiClient.post<DispatchResponse>(
      `/api/v1/advisory-drafts/${id}/resend`,
      payload,
    );
    return data;
  },

  listByContract: async (contractId: number): Promise<ContractAdvisorySummary[]> => {
    const { data } = await apiClient.get<ContractAdvisorySummary[]>(
      `/api/v1/advisory-drafts/by-contract/${contractId}`,
    );
    return data;
  },

  resolveRecipient: async (contractId: number): Promise<RecipientResolution> => {
    const { data } = await apiClient.get<RecipientResolution>(
      `/api/v1/advisory-drafts/recipient/${contractId}`,
    );
    return data;
  },

  // 2026-06-15 — Phase 2: drafts awaiting executive review (exec inbox).
  pendingForExecutive: async (): Promise<PendingAdvisoryRow[]> => {
    const { data } = await apiClient.get<PendingAdvisoryRow[]>(
      `/api/v1/advisory-drafts/pending-for-executive`,
    );
    return data;
  },

  execModify: async (
    id: number,
    payload: { modifiedTextEn: string; modifiedTextAr?: string },
  ): Promise<ExecApproveResponse> => {
    const { data } = await apiClient.post<ExecApproveResponse>(
      `/api/v1/advisory-drafts/${id}/exec-modify`,
      payload,
    );
    return data;
  },
};

export interface PendingAdvisoryRow {
  id: number;
  draftType: string;
  templateId: string;
  templateDisplayEn: string;
  templateDisplayAr: string | null;
  approvalStatus: string;
  reviewPath: string | null;
  currentReviewer: string | null;
  linkedRiskCaseId: string | null;
  contractId: number;
  contractNumber: string;
  contractTitle: string | null;
  counterpartyName: string | null;
  createdAt: string;
  createdBy: number | null;
  createdByName: string | null;
  routedAt: string | null;
  generatedTextEn: string;
  generatedTextAr: string | null;
  finalTextEn: string | null;
  finalTextAr: string | null;
}

// ─── Local types for the v2 workflow ─────────────────────────────────────
export interface SendPayload {
  recipientAddress: string;
  recipientName?: string;
}

export interface DispatchResponse {
  id: number;
  dispatched: boolean;
  isResend?: boolean;
  advisoryDispatchLogId?: number;
  notificationLogId?: number;
  recipientAddress?: string;
}

export interface GenerateFromRiskCaseResponse {
  id: number;
  correlationId: number;
  contractId: number;
  templateId: number;
  draftType: string;
  approvalStatus: string;
  reviewPath: 'send_directly' | 'executive_review';
  currentReviewer: 'executive' | 'legal_counsel' | null;
  linkedRiskCaseId: number | null;
}

export interface RouteForReviewResponse {
  id: number;
  routedTo: 'executive';
  reviewerUserId: number | null;
  notificationLogId: number;
}

export interface ExecApproveResponse {
  id: number;
  approved: boolean;
  handedBackTo: 'legal_counsel';
  notificationLogId: number;
}

export interface ContractAdvisorySummary {
  id: number;
  draftType: string;
  templateId: string;
  templateDisplayEn: string;
  templateDisplayAr: string | null;
  approvalStatus: 'unapproved' | 'approved' | 'rejected' | 'modified';
  reviewPath: 'send_directly' | 'executive_review' | null;
  currentReviewer: 'executive' | 'legal_counsel' | null;
  linkedRiskCaseId: string | null;
  createdAt: string;
  createdBy: number | null;
  createdByName: string | null;
  approvedAt: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  dispatchedAt: string | null;
  dispatchChannel: string | null;
  dispatchRecipients: Array<{ address: string; name: string | null }>;
  dispatchCount: number;
  lastDispatchAt: string | null;
  generatedTextEn: string;
  generatedTextAr: string | null;
  finalTextEn: string | null;
  finalTextAr: string | null;
}

export interface RecipientResolution {
  recipientAddress: string;
  recipientName: string;
  source: 'party_contact' | 'signer' | 'demo_fallback';
  counterpartyName: string | null;
}
