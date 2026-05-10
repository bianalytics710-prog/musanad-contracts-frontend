/**
 * Admin / branding service.
 * Wraps GET  /api/v1/admin/branding
 *       PATCH /api/v1/admin/branding
 *       POST  /api/v1/admin/branding/upload
 */
import { apiClient } from '@/lib/api-client';
import type { BrandingUploadResult, BrandingConfig, BrandingPatchDto } from '@/types/admin/branding.types';

export const adminBrandingService = {
  get: async (): Promise<BrandingConfig> => {
    const { data } = await apiClient.get<BrandingConfig>(
      '/api/v1/admin/branding',
    );
    return data;
  },

  patch: async (payload: BrandingPatchDto): Promise<BrandingConfig> => {
    const { data } = await apiClient.patch<BrandingConfig>(
      '/api/v1/admin/branding',
      payload,
    );
    return data;
  },

  upload: async (kind: 'logo' | 'favicon', file: File): Promise<BrandingUploadResult> => {
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);
    const { data } = await apiClient.post<BrandingUploadResult>(
      '/api/v1/admin/branding/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },
};
