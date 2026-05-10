/**
 * Admin / demo data purge service.
 * Wraps POST /api/v1/admin/demo/purge
 *      GET  /api/v1/admin/demo/data-classification-summary
 */
import { apiClient } from '@/lib/api-client';
import type {
  DemoPurgeRequest,
  DemoPurgeResult,
  DataClassificationSummary,
} from '@/types/admin/demo.types';

export const adminDemoService = {
  purge: async (payload: DemoPurgeRequest): Promise<DemoPurgeResult> => {
    const { data } = await apiClient.post<DemoPurgeResult>(
      '/api/v1/admin/demo/purge',
      payload,
    );
    return data;
  },

  dataClassificationSummary: async (): Promise<DataClassificationSummary> => {
    const { data } = await apiClient.get<DataClassificationSummary>(
      '/api/v1/admin/demo/data-classification-summary',
    );
    return data;
  },
};
