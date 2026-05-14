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
};
