/**
 * Admin / roles management service.
 * Wraps POST   /api/v1/admin/roles
 *       PATCH  /api/v1/admin/roles/:id
 *       DELETE /api/v1/admin/roles/:id
 *       POST   /api/v1/admin/roles/:id/permissions/:permId/grant
 *       DELETE /api/v1/admin/roles/:id/permissions/:permId/revoke
 */
import { apiClient } from '@/lib/api-client';
import type {
  CreateRoleDto,
  RoleCreateResult,
  UpdateRoleDto,
  RoleUpdateResult,
  RoleDeleteResult,
  RolePermissionGrantResult,
  RolePermissionRevokeResult,
} from '@/types/admin/roles-mgmt.types';

export const adminRolesMgmtService = {
  create: async (payload: CreateRoleDto): Promise<RoleCreateResult> => {
    const { data } = await apiClient.post<RoleCreateResult>(
      '/api/v1/admin/roles',
      payload,
    );
    return data;
  },

  update: async (id: number, payload: UpdateRoleDto): Promise<RoleUpdateResult> => {
    const { data } = await apiClient.patch<RoleUpdateResult>(
      `/api/v1/admin/roles/${id}`,
      payload,
    );
    return data;
  },

  delete: async (id: number): Promise<RoleDeleteResult> => {
    const { data } = await apiClient.delete<RoleDeleteResult>(
      `/api/v1/admin/roles/${id}`,
    );
    return data;
  },

  grantPermission: async (
    roleId: number,
    permId: number,
  ): Promise<RolePermissionGrantResult> => {
    const { data } = await apiClient.post<RolePermissionGrantResult>(
      `/api/v1/admin/roles/${roleId}/permissions/${permId}/grant`,
    );
    return data;
  },

  revokePermission: async (
    roleId: number,
    permId: number,
  ): Promise<RolePermissionRevokeResult> => {
    const { data } = await apiClient.delete<RolePermissionRevokeResult>(
      `/api/v1/admin/roles/${roleId}/permissions/${permId}/revoke`,
    );
    return data;
  },
};
