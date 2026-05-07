/**
 * Admin / users API service. Wraps the /api/v1/users endpoints used by the
 * platform admin row actions: list, invite, update (role / suspend /
 * reactivate), reset password.
 */
import { apiClient } from "@/lib/api-client";

export interface AdminUserListItem {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  role: { id: number; name: string };
}

export interface AdminUserListResponse {
  data: AdminUserListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface InviteUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleId: number;
}

export interface UpdateUserPayload {
  email?: string;
  firstName?: string;
  lastName?: string;
  roleId?: number;
  isActive?: boolean;
}

export interface AdminRoleListItem {
  id: number;
  name: string;
  description: string | null;
}

export interface AdminRoleListResponse {
  data: AdminRoleListItem[];
}

export const adminUsersService = {
  list: async (params: {
    search?: string;
    roleId?: number;
    page?: number;
    limit?: number;
  } = {}): Promise<AdminUserListResponse> => {
    const { data } = await apiClient.get<AdminUserListResponse>(
      "/api/v1/users",
      { params },
    );
    return data;
  },

  create: async (payload: InviteUserPayload): Promise<AdminUserListItem> => {
    const { data } = await apiClient.post<AdminUserListItem>(
      "/api/v1/users",
      payload,
    );
    return data;
  },

  update: async (
    id: number,
    payload: UpdateUserPayload,
  ): Promise<AdminUserListItem> => {
    const { data } = await apiClient.put<AdminUserListItem>(
      `/api/v1/users/${id}`,
      payload,
    );
    return data;
  },

  resetPassword: async (
    id: number,
    payload: { password: string },
  ): Promise<{ success: boolean; message: string; userId: number }> => {
    const { data } = await apiClient.post<{
      success: boolean;
      message: string;
      userId: number;
    }>(`/api/v1/users/${id}/reset-password`, payload);
    return data;
  },

  suspend: async (id: number): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.delete<{ success: boolean; message: string }>(
      `/api/v1/users/${id}`,
    );
    return data;
  },
};

export const adminRolesService = {
  list: async (): Promise<AdminRoleListResponse> => {
    const { data } = await apiClient.get<AdminRoleListResponse>(
      "/api/v1/roles",
      { params: { limit: 200 } },
    );
    return data;
  },
};
