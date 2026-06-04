/**
 * TPA — Third-Party Agreement Assessment service.
 * Wraps /api/v1/tpa/* endpoints. A7: all HTTP through apiClient here.
 */
import { apiClient } from '@/lib/api-client';
import type {
  Playbook,
  PlaybookListItem,
  ReviewDetail,
  ListReviewsParams,
  ListReviewsResponse,
  UploadResponse,
  UpdateFindingPayload,
  SetStatusPayload,
} from '@/types/tpa.types';

export const tpaService = {
  listPlaybooks: async (): Promise<{ data: PlaybookListItem[] }> => {
    const { data } = await apiClient.get<{ data: PlaybookListItem[] }>(
      '/api/v1/tpa/playbooks',
    );
    return data;
  },

  getPlaybook: async (id: number): Promise<Playbook> => {
    const { data } = await apiClient.get<Playbook>(`/api/v1/tpa/playbooks/${id}`);
    return data;
  },

  listReviews: async (params: ListReviewsParams = {}): Promise<ListReviewsResponse> => {
    const { data } = await apiClient.get<ListReviewsResponse>('/api/v1/tpa/reviews', {
      params,
    });
    return data;
  },

  getReview: async (id: number): Promise<ReviewDetail> => {
    const { data } = await apiClient.get<ReviewDetail>(`/api/v1/tpa/reviews/${id}`);
    return data;
  },

  upload: async (payload: {
    file: File;
    playbookId: number;
    agreementType: string;
    counterpartyName: string;
    counterpartyEmail?: string;
    agreementTitle: string;
  }): Promise<UploadResponse> => {
    const fd = new FormData();
    fd.append('file', payload.file);
    fd.append('playbookId', String(payload.playbookId));
    fd.append('agreementType', payload.agreementType);
    fd.append('counterpartyName', payload.counterpartyName);
    if (payload.counterpartyEmail) fd.append('counterpartyEmail', payload.counterpartyEmail);
    fd.append('agreementTitle', payload.agreementTitle);

    const { data } = await apiClient.post<UploadResponse>(
      '/api/v1/tpa/reviews/upload',
      fd,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Analysis can take 30-60s depending on doc length
        timeout: 120000,
      },
    );
    return data;
  },

  updateFinding: async (
    reviewId: number,
    findingId: number,
    payload: UpdateFindingPayload,
  ): Promise<{ findingId: number; reviewId: number }> => {
    const { data } = await apiClient.patch<{ findingId: number; reviewId: number }>(
      `/api/v1/tpa/reviews/${reviewId}/findings/${findingId}`,
      payload,
    );
    return data;
  },

  setStatus: async (
    reviewId: number,
    payload: SetStatusPayload,
  ): Promise<{ reviewId: number; status: string }> => {
    const { data } = await apiClient.post<{ reviewId: number; status: string }>(
      `/api/v1/tpa/reviews/${reviewId}/status`,
      payload,
    );
    return data;
  },

  downloadRedlineUrl: (reviewId: number): string =>
    `/api/v1/tpa/reviews/${reviewId}/redline.docx`,
};
