/**
 * Top Business Partners drilldown service — mig 558.
 *   GET /api/v1/dashboards/executive/top-counterparty-contracts/:counterpartyId
 */
import { apiClient } from '@/lib/api-client';

export interface CounterpartyContractRow {
  contractId: string;
  contractNumber: string;
  titleEn: string | null;
  titleAr: string | null;
  counterpartyName: string | null;
  valueAed: number | string | null;
  currency: string | null;
  status: string;
  endDate: string;
}

export interface CounterpartyContractsResponse {
  counterpartyId: number;
  rows: CounterpartyContractRow[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export const topCounterpartyService = {
  contracts: async (counterpartyId: number): Promise<CounterpartyContractsResponse> => {
    const res = await apiClient.get<Envelope<CounterpartyContractsResponse>>(
      `/api/v1/dashboards/executive/top-counterparty-contracts/${counterpartyId}`,
    );
    return res.data.data;
  },
};
