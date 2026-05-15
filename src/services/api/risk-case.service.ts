/**
 * Unit 7 / CR-K — Risk Case service.
 *
 * Wraps the 12 user-facing /risk-cases routes (Agent 7 BE Impl):
 *   GET    /api/v1/risk-cases
 *   POST   /api/v1/risk-cases
 *   GET    /api/v1/risk-cases/:id
 *   POST   /api/v1/risk-cases/:id/assign
 *   POST   /api/v1/risk-cases/:id/comments
 *   POST   /api/v1/risk-cases/:id/evidence
 *   GET    /api/v1/risk-cases/:id/evidence/:attachmentId
 *   POST   /api/v1/risk-cases/:id/status-transition
 *   POST   /api/v1/risk-cases/:id/escalate
 *   POST   /api/v1/risk-cases/:id/accept-risk
 *   POST   /api/v1/risk-cases/:id/snooze
 *   POST   /api/v1/risk-cases/:id/close
 *
 * A7 compliance: apiClient lives only in this file.
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  RiskCaseListQuery,
  RiskCaseListResponse,
  RiskCaseDetail,
  CreateRiskCaseDto,
  AssignRiskCaseDto,
  AddRiskCaseCommentDto,
  AddRiskCaseCommentResponse,
  AddRiskCaseEvidenceDto,
  AddRiskCaseEvidenceResponse,
  StatusTransitionRiskCaseDto,
  EscalateRiskCaseDto,
  EscalateRiskCaseResponse,
  AcceptRiskCaseDto,
  SnoozeRiskCaseDto,
  CloseRiskCaseDto,
  RiskCaseEvidenceDetail,
} from '@/types/risk-case.types';

const BASE = '/api/v1/risk-cases';

export const riskCaseService = {
  list: async (params: RiskCaseListQuery = {}): Promise<RiskCaseListResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: RiskCaseListResponse }>(
      BASE,
      { params },
    );
    return unwrap<RiskCaseListResponse>(data);
  },

  getById: async (id: number): Promise<RiskCaseDetail> => {
    const { data } = await apiClient.get<{ success: boolean; data: RiskCaseDetail }>(
      `${BASE}/${id}`,
    );
    return unwrap<RiskCaseDetail>(data);
  },

  create: async (payload: CreateRiskCaseDto): Promise<RiskCaseDetail> => {
    const { data } = await apiClient.post<{ success: boolean; data: RiskCaseDetail }>(
      BASE,
      payload,
    );
    return unwrap<RiskCaseDetail>(data);
  },

  assign: async (id: number, payload: AssignRiskCaseDto): Promise<RiskCaseDetail> => {
    const { data } = await apiClient.post<{ success: boolean; data: RiskCaseDetail }>(
      `${BASE}/${id}/assign`,
      payload,
    );
    return unwrap<RiskCaseDetail>(data);
  },

  addComment: async (
    id: number,
    payload: AddRiskCaseCommentDto,
  ): Promise<AddRiskCaseCommentResponse> => {
    const { data } = await apiClient.post<{ success: boolean; data: AddRiskCaseCommentResponse }>(
      `${BASE}/${id}/comments`,
      payload,
    );
    return unwrap<AddRiskCaseCommentResponse>(data);
  },

  /**
   * @deprecated DEFECT-CRKL-INTV-1 — the evidence endpoint is multipart/form-data,
   * not JSON. Use `uploadEvidence(id, file, opts?)` instead. This method is
   * retained for type-only callers; calling it at runtime will result in a 400
   * because the BE has no JSON branch for this route.
   */
  addEvidence: async (
    id: number,
    payload: AddRiskCaseEvidenceDto,
  ): Promise<AddRiskCaseEvidenceResponse> => {
    const { data } = await apiClient.post<{
      success: boolean;
      data: AddRiskCaseEvidenceResponse;
    }>(`${BASE}/${id}/evidence`, payload);
    return unwrap<AddRiskCaseEvidenceResponse>(data);
  },

  /**
   * DEFECT-CRKL-INTV-1 — multipart/form-data evidence upload (S-K-7).
   *
   * Builds the FormData internally so consumers (AddEvidenceDialog,
   * drag-drop receivers, etc.) only deal with the File handle. The BE
   * controller stores the binary in Supabase Storage and derives the
   * fileUri — the client only supplies the binary + optional kind /
   * description metadata.
   *
   * 50 MB cap is enforced both client-side (AddEvidenceDialog) and
   * server-side (multer.limits.fileSize + controller defence-in-depth).
   */
  uploadEvidence: async (
    id: number,
    file: File,
    opts: { kind?: string; description?: string } = {},
  ): Promise<AddRiskCaseEvidenceResponse> => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('fileName', file.name);
    fd.append('fileMime', file.type || 'application/octet-stream');
    fd.append('fileBytes', String(file.size));
    if (opts.kind) fd.append('kind', opts.kind);
    if (opts.description) fd.append('description', opts.description);

    const { data } = await apiClient.post<{
      success: boolean;
      data: AddRiskCaseEvidenceResponse;
    }>(`${BASE}/${id}/evidence`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap<AddRiskCaseEvidenceResponse>(data);
  },

  getEvidence: async (
    id: number,
    attachmentId: number,
  ): Promise<RiskCaseEvidenceDetail> => {
    const { data } = await apiClient.get<{ success: boolean; data: RiskCaseEvidenceDetail }>(
      `${BASE}/${id}/evidence/${attachmentId}`,
    );
    return unwrap<RiskCaseEvidenceDetail>(data);
  },

  statusTransition: async (
    id: number,
    payload: StatusTransitionRiskCaseDto,
  ): Promise<RiskCaseDetail> => {
    const { data } = await apiClient.post<{ success: boolean; data: RiskCaseDetail }>(
      `${BASE}/${id}/status-transition`,
      payload,
    );
    return unwrap<RiskCaseDetail>(data);
  },

  escalate: async (
    id: number,
    payload: EscalateRiskCaseDto = {},
  ): Promise<EscalateRiskCaseResponse> => {
    const { data } = await apiClient.post<{ success: boolean; data: EscalateRiskCaseResponse }>(
      `${BASE}/${id}/escalate`,
      payload,
    );
    return unwrap<EscalateRiskCaseResponse>(data);
  },

  acceptRisk: async (id: number, payload: AcceptRiskCaseDto): Promise<RiskCaseDetail> => {
    const { data } = await apiClient.post<{ success: boolean; data: RiskCaseDetail }>(
      `${BASE}/${id}/accept-risk`,
      payload,
    );
    return unwrap<RiskCaseDetail>(data);
  },

  snooze: async (id: number, payload: SnoozeRiskCaseDto): Promise<RiskCaseDetail> => {
    const { data } = await apiClient.post<{ success: boolean; data: RiskCaseDetail }>(
      `${BASE}/${id}/snooze`,
      payload,
    );
    return unwrap<RiskCaseDetail>(data);
  },

  close: async (id: number, payload: CloseRiskCaseDto): Promise<RiskCaseDetail> => {
    const { data } = await apiClient.post<{ success: boolean; data: RiskCaseDetail }>(
      `${BASE}/${id}/close`,
      payload,
    );
    return unwrap<RiskCaseDetail>(data);
  },
};
