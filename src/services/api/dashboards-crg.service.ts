/**
 * M15 / CR-G — Dashboard service for 4 new persona dashboards.
 *
 * A7 compliance: all HTTP calls go through this service module.
 * Endpoints:
 *   GET /api/v1/dashboards/operations          (gated insights.operations)
 *   GET /api/v1/dashboards/finance-treasury    (gated insights.finance_treasury)
 *   GET /api/v1/dashboards/compliance-esg      (gated insights.compliance_esg)
 *   GET /api/v1/dashboards/procurement         (gated insights.procurement_supplier_risk)
 *
 * BE controllers emit `{success:true, data:T}` envelope — use unwrap pattern
 * (same as M14 risk-score.service.ts) per memory feedback M11 FIX-1 envelope regression.
 *
 * Note: existing executive dashboard uses dashboards.service.ts (getExecutiveDashboard).
 * The executive extension (3 new keys) is delivered via the SAME endpoint — no new
 * service method needed here for executive (the existing service returns the extended shape).
 */

import { apiClient, unwrap } from '@/lib/api-client';
import type {
  OperationsDashboardResponse,
  FinanceTreasuryDashboardResponse,
  ComplianceEsgDashboardResponse,
  ProcurementSupplierRiskDashboardResponse,
} from '@/types/entities/crg-dashboards.types';

const BASE = '/api/v1';

export const dashboardsCrgService = {
  getOperations: async (windowDays = 30): Promise<OperationsDashboardResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: OperationsDashboardResponse }>(
      `${BASE}/dashboards/operations`,
      { params: { windowDays } },
    );
    return unwrap<OperationsDashboardResponse>(data);
  },

  getFinanceTreasury: async (windowDays = 30): Promise<FinanceTreasuryDashboardResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: FinanceTreasuryDashboardResponse }>(
      `${BASE}/dashboards/finance-treasury`,
      { params: { windowDays } },
    );
    return unwrap<FinanceTreasuryDashboardResponse>(data);
  },

  getComplianceEsg: async (windowDays = 30): Promise<ComplianceEsgDashboardResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: ComplianceEsgDashboardResponse }>(
      `${BASE}/dashboards/compliance-esg`,
      { params: { windowDays } },
    );
    return unwrap<ComplianceEsgDashboardResponse>(data);
  },

  getProcurement: async (windowDays = 90): Promise<ProcurementSupplierRiskDashboardResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: ProcurementSupplierRiskDashboardResponse }>(
      `${BASE}/dashboards/procurement`,
      { params: { windowDays } },
    );
    return unwrap<ProcurementSupplierRiskDashboardResponse>(data);
  },
};

export type DashboardsCrgService = typeof dashboardsCrgService;
