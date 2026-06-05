/**
 * Executive trends side-car service — mig 559.
 *   GET /api/v1/dashboards/executive/trends-extended?months=6
 */
import { apiClient } from '@/lib/api-client';
import type { TrendMonthCount, TrendMonthValueAed } from '@/types/entities/dashboards.types';

export interface ExecutiveTrendsExtendedResponse {
  months: number;
  valueOverTimeByMonth: TrendMonthValueAed[];
  contractsCreatedByMonth: TrendMonthCount[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export const executiveTrendsService = {
  extended: async (months = 6): Promise<ExecutiveTrendsExtendedResponse> => {
    const res = await apiClient.get<Envelope<ExecutiveTrendsExtendedResponse>>(
      `/api/v1/dashboards/executive/trends-extended`,
      { params: { months } },
    );
    return res.data.data;
  },
};
