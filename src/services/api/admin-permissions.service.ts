/**
 * Admin / permissions API service. Wraps /api/v1/permissions.
 *
 * Used by /app/admin/roles to render the master permission catalog and
 * the per-role permission filter for the read-only roles × permissions
 * matrix.
 */
import { apiClient } from "@/lib/api-client";

export interface PermissionRow {
  id: number;
  code: string;
  module: string;
  action: string;
  description: string | null;
}

export interface PermissionListResponse {
  data: PermissionRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const adminPermissionsService = {
  listAll: async (): Promise<PermissionListResponse> => {
    const { data } = await apiClient.get<PermissionListResponse>(
      "/api/v1/permissions",
      { params: { limit: 200 } },
    );
    return data;
  },

  listForRole: async (roleId: number): Promise<PermissionListResponse> => {
    const { data } = await apiClient.get<PermissionListResponse>(
      "/api/v1/permissions",
      { params: { roleId, limit: 200 } },
    );
    return data;
  },
};
