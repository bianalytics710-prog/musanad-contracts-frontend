/**
 * Admin / Advisory Templates service.
 * Wraps GET   /api/v1/admin/advisory-templates
 *       GET   /api/v1/admin/advisory-templates/:id
 *       POST  /api/v1/admin/advisory-templates
 *       PATCH /api/v1/admin/advisory-templates/:id
 *       DELETE /api/v1/admin/advisory-templates/:id
 *
 * A7 compliance: all HTTP calls go through apiClient here — never in pages/components.
 */
import { apiClient } from '@/lib/api-client';
import type {
  AdvisoryTemplateListItem,
  AdvisoryTemplate,
  ListAdvisoryTemplatesResponse,
  CreateAdvisoryTemplateDto,
  UpdateAdvisoryTemplateDto,
} from '@/types/admin/advisory-templates.types';

export interface ListAdvisoryTemplatesParams {
  page?: number;
  limit?: number;
  draftType?: string;
  isActive?: boolean;
  search?: string;
}

export const adminAdvisoryTemplatesService = {
  list: async (
    params: ListAdvisoryTemplatesParams = {},
  ): Promise<ListAdvisoryTemplatesResponse> => {
    const { data } = await apiClient.get<ListAdvisoryTemplatesResponse>(
      '/api/v1/admin/advisory-templates',
      { params },
    );
    return data;
  },

  getById: async (id: number): Promise<AdvisoryTemplate> => {
    const { data } = await apiClient.get<AdvisoryTemplate>(
      `/api/v1/admin/advisory-templates/${id}`,
    );
    return data;
  },

  create: async (payload: CreateAdvisoryTemplateDto): Promise<AdvisoryTemplate> => {
    const { data } = await apiClient.post<AdvisoryTemplate>(
      '/api/v1/admin/advisory-templates',
      payload,
    );
    return data;
  },

  update: async (
    id: number,
    payload: UpdateAdvisoryTemplateDto,
  ): Promise<AdvisoryTemplate> => {
    const { data } = await apiClient.patch<AdvisoryTemplate>(
      `/api/v1/admin/advisory-templates/${id}`,
      payload,
    );
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/admin/advisory-templates/${id}`);
  },

  /** Convenience: list role names for the approver role selector. */
  listApproverRoles: (): string[] => [
    'legal_counsel',
    'contract_approver',
    'contract_approver_2',
    'platform_admin',
    'Super Admin',
  ],
};

// Re-export list item type for consumers
export type { AdvisoryTemplateListItem };
