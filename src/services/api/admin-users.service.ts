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
  pagination: { page: number; limit: number; total: number; totalPages: number };
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
};
