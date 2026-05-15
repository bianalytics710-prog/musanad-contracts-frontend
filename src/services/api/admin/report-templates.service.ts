/**
 * Unit 7 / CR-L — Admin Report Template CRUD service.
 *
 * Wraps:
 *   GET    /api/v1/admin/reports/templates
 *   GET    /api/v1/admin/reports/templates/:id
 *   POST   /api/v1/admin/reports/templates
 *   PUT    /api/v1/admin/reports/templates/:id
 *   DELETE /api/v1/admin/reports/templates/:id
 *
 * A7 compliance: apiClient lives only in this file.
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  ReportTemplate,
  ReportTemplateAdminListResponse,
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  DeleteReportTemplateResponse,
} from '@/types/report.types';

const BASE = '/api/v1/admin/reports/templates';

export const adminReportTemplatesService = {
  list: async (): Promise<ReportTemplateAdminListResponse> => {
    const { data } = await apiClient.get<{
      success: boolean;
      data: ReportTemplateAdminListResponse;
    }>(BASE);
    return unwrap<ReportTemplateAdminListResponse>(data);
  },

  getById: async (id: number): Promise<ReportTemplate> => {
    const { data } = await apiClient.get<{ success: boolean; data: ReportTemplate }>(
      `${BASE}/${id}`,
    );
    return unwrap<ReportTemplate>(data);
  },

  create: async (payload: CreateReportTemplateDto): Promise<ReportTemplate> => {
    const { data } = await apiClient.post<{ success: boolean; data: ReportTemplate }>(
      BASE,
      payload,
    );
    return unwrap<ReportTemplate>(data);
  },

  update: async (id: number, payload: UpdateReportTemplateDto): Promise<ReportTemplate> => {
    const { data } = await apiClient.put<{ success: boolean; data: ReportTemplate }>(
      `${BASE}/${id}`,
      payload,
    );
    return unwrap<ReportTemplate>(data);
  },

  delete: async (id: number): Promise<DeleteReportTemplateResponse> => {
    const { data } = await apiClient.delete<{
      success: boolean;
      data: DeleteReportTemplateResponse;
    }>(`${BASE}/${id}`);
    return unwrap<DeleteReportTemplateResponse>(data);
  },
};
