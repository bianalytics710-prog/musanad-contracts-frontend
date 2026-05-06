/**
 * Admin / users API service — read-only listing for the admin user table.
 * Wraps existing GET /api/v1/users.
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
  pagination: { total: number; limit: number; offset: number };
}

export const adminUsersService = {
  list: async (params: {
    q?: string;
    roleId?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<AdminUserListResponse> => {
    const { data } = await apiClient.get<AdminUserListResponse>(
      "/api/v1/users",
      { params },
    );
    return data;
  },
};
