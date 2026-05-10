/**
 * Admin / tenants service.
 * Wraps GET /api/v1/admin/tenants
 *      GET /api/v1/admin/tenants/:id
 */
import { apiClient } from '@/lib/api-client';
import type {
  ListTenantsResponse,
  TenantDetail,
} from '@/types/admin/tenants.types';

export interface ListTenantsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const adminTenantsService = {
  list: async (params: ListTenantsParams = {}): Promise<ListTenantsResponse> => {
    const { data } = await apiClient.get<ListTenantsResponse>(
      '/api/v1/admin/tenants',
      { params },
    );
    return data;
  },

  getById: async (id: string): Promise<TenantDetail> => {
    const { data } = await apiClient.get<TenantDetail>(
      `/api/v1/admin/tenants/${id}`,
    );
    return data;
  },
};
