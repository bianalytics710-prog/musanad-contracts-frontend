/**
 * Dev Login Personas service — mig 538.
 *
 * GET is intentionally unauthenticated — the login page reaches this BE
 * endpoint before the user has signed in. PUT requires admin auth.
 */
import { apiClient, unwrap } from '@/lib/api-client';

export interface DevLoginPersonasGetResponse {
  hidden: string[];
}

export interface DevLoginPersonasSetResponse {
  hidden: string[];
  updatedBy: number;
}

export const devLoginPersonasService = {
  async getHidden(): Promise<string[]> {
    try {
      const { data } = await apiClient.get<{ success: boolean; data: DevLoginPersonasGetResponse }>(
        '/api/v1/public/dev-login-personas',
      );
      const parsed = unwrap<DevLoginPersonasGetResponse>(data);
      return parsed?.hidden ?? [];
    } catch {
      // If the endpoint fails (e.g. server cold-start during local dev),
      // fall back to showing every persona. Better UX than crashing the
      // login page.
      return [];
    }
  },

  async setHidden(hidden: string[]): Promise<DevLoginPersonasSetResponse> {
    const { data } = await apiClient.put<{ success: boolean; data: DevLoginPersonasSetResponse }>(
      '/api/v1/admin/dev-login-personas',
      { hidden },
    );
    return unwrap<DevLoginPersonasSetResponse>(data);
  },
};
