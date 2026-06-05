/**
 * Admin Tenants service — R-IL Phase G tenant-create endpoint.
 *
 *   POST /api/v1/admin/tenants  (tenant.manage)
 *
 * Read endpoints (GET / and GET /:id) sit under separate services already.
 */
import { apiClient } from '@/lib/api-client';

export interface CreateTenantInput {
  slug: string;
  displayName: string;
  name: string;
  industryId: number;
  configPack?: string | null;
  riskAppetite?: 'low' | 'standard' | 'aggressive' | null;
  dataRegion?: string | null;
}

export interface CreateTenantResult {
  id: string;
  slug: string;
  displayName: string;
  name: string;
  industryId: number;
  industryCode: string;
}

export const adminTenantService = {
  create: async (input: CreateTenantInput): Promise<CreateTenantResult> => {
    const r = await apiClient.post<CreateTenantResult>(
      `/api/v1/admin/tenants`,
      input,
    );
    return r.data;
  },
};
