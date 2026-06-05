/**
 * Executive Expiry-Cliff frame service — mig 554.
 *
 *   GET  /api/v1/dashboards/executive/expiring-contracts?windowDays=30|60|90
 *   POST /api/v1/dashboards/executive/expiring-contracts/escalate
 */
import { apiClient } from '@/lib/api-client';

export interface ExpiringContractRow {
  contractId: string;
  contractNumber: string;
  titleEn: string | null;
  titleAr: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  drafterId: string | null;
  drafterName: string | null;
  drafterEmail: string | null;
  valueAed: number | string | null;
  currency: string | null;
  endDate: string;
  daysToExpiry: number;
  escalatedAt: string | null;
  escalatedByName: string | null;
  escalationNote: string | null;
  escalationCount: number | null;
}

export interface ExpiringContractsResponse {
  windowDays: number;
  asOf: string;
  rows: ExpiringContractRow[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface EscalateResult {
  sent: number;
  skipped: number;
  eventIds: number[];
  skippedIds: number[];
}

export const expiryCliffService = {
  list: async (windowDays: 30 | 60 | 90): Promise<ExpiringContractsResponse> => {
    const res = await apiClient.get<Envelope<ExpiringContractsResponse>>(
      `/api/v1/dashboards/executive/expiring-contracts`,
      { params: { windowDays } },
    );
    return res.data.data;
  },

  escalate: async (params: {
    contractIds: number[];
    windowDays: 30 | 60 | 90;
    note?: string;
  }): Promise<EscalateResult> => {
    const res = await apiClient.post<Envelope<EscalateResult>>(
      `/api/v1/dashboards/executive/expiring-contracts/escalate`,
      params,
    );
    return res.data.data;
  },
};
