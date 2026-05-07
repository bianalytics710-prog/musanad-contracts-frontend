/**
 * Admin / settings API service. Wraps /api/v1/admin/settings.
 */
import { apiClient } from "@/lib/api-client";

export type SettingCategory = "general" | "uae_pass" | "branding";

export interface SystemSettingRow {
  key: string;
  value: unknown;
  description: string | null;
  category: SettingCategory;
  isSecret: boolean;
  updatedAt: string;
}

export interface SystemSettingListResponse {
  settings: SystemSettingRow[];
}

export interface SystemSettingSetResponse {
  key: string;
  value: unknown;
  category: SettingCategory;
  updatedAt: string;
}

export const adminSettingsService = {
  list: async (): Promise<SystemSettingListResponse> => {
    const { data } = await apiClient.get<SystemSettingListResponse>(
      "/api/v1/admin/settings",
    );
    return data;
  },

  set: async (
    key: string,
    value: unknown,
  ): Promise<SystemSettingSetResponse> => {
    const { data } = await apiClient.put<SystemSettingSetResponse>(
      `/api/v1/admin/settings/${encodeURIComponent(key)}`,
      { value },
    );
    return data;
  },
};
