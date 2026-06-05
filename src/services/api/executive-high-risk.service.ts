/**
 * Executive high-risk side-car service — mig 560.
 *   GET /api/v1/dashboards/executive/high-risk?limit=8
 *
 * Returns the extended high-risk rows (with counterpartyName + riskType
 * slug from fn_classify_risk) for the ECIP section's "High-risk
 * contracts" table.
 */
import { apiClient } from '@/lib/api-client';
import type { RiskTypeSlug } from '@/components/risk/RiskTypePill';

export interface ExecutiveHighRiskExtendedRow {
  id: number;
  contractNumber: string;
  titleEn: string | null;
  titleAr: string | null;
  valueAed: number | null;
  riskScore: number;
  counterpartyName: string | null;
  riskType: RiskTypeSlug | null;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export const executiveHighRiskService = {
  list: async (limit = 8): Promise<ExecutiveHighRiskExtendedRow[]> => {
    const res = await apiClient.get<Envelope<ExecutiveHighRiskExtendedRow[] | null>>(
      `/api/v1/dashboards/executive/high-risk`,
      { params: { limit } },
    );
    return res.data.data ?? [];
  },
};
