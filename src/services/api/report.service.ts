/**
 * Unit 7 / CR-L — Report Library + Run service (user-facing).
 *
 * Wraps:
 *   GET    /api/v1/reports/templates
 *   POST   /api/v1/reports/templates/:id/run
 *   GET    /api/v1/reports/runs/:id
 *
 * A7 compliance: apiClient lives only in this file.
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  ReportTemplateUserListResponse,
  ReportTemplateAdminListResponse,
  TriggerReportRunDto,
  TriggerReportRunResponse,
  ReportRunDetail,
} from '@/types/report.types';

const BASE = '/api/v1/reports';

export const reportService = {
  /**
   * List report templates available to the caller.
   * adminMode=true requires report.template.manage and returns
   * ReportTemplateAdminListItem[]; otherwise filters by assigned_roles overlap.
   */
  listTemplates: async (params: { adminMode?: boolean } = {}) => {
    const { data } = await apiClient.get<{
      success: boolean;
      data: ReportTemplateUserListResponse | ReportTemplateAdminListResponse;
    }>(`${BASE}/templates`, { params });
    return unwrap<ReportTemplateUserListResponse | ReportTemplateAdminListResponse>(data);
  },

  triggerRun: async (
    templateId: number,
    payload: TriggerReportRunDto,
  ): Promise<TriggerReportRunResponse> => {
    const { data } = await apiClient.post<{
      success: boolean;
      data: TriggerReportRunResponse;
    }>(`${BASE}/templates/${templateId}/run`, payload);
    return unwrap<TriggerReportRunResponse>(data);
  },

  getRunById: async (runId: number): Promise<ReportRunDetail> => {
    const { data } = await apiClient.get<{ success: boolean; data: ReportRunDetail }>(
      `${BASE}/runs/${runId}`,
    );
    return unwrap<ReportRunDetail>(data);
  },
};
