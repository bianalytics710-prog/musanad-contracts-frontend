/**
 * Admin risk-routing service — Phase B.2 client.
 */
import { apiClient } from '@/lib/api-client';

export interface RiskRoutingRule {
  id: string;
  ruleOrder: number;
  caseType: string | null;
  riskType: string | null;
  priorityMin: string | null;
  contractType: string | null;
  assignedRole: string;
  slaHours: number;
  materialityFloorAed: number | null;
  confidenceFloor: number | null;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface RoutingRuleInput {
  ruleOrder: number;
  caseType: string | null;
  riskType: string | null;
  priorityMin: string | null;
  contractType: string | null;
  assignedRole: string;
  slaHours: number;
  materialityFloorAed: number | null;
  confidenceFloor: number | null;
  description: string | null;
  isActive: boolean;
}

const BASE = '/api/v1/admin/risk-routing';

export const riskRoutingService = {
  list: async (): Promise<RiskRoutingRule[]> => {
    const { data } = await apiClient.get<{ success: boolean; data: { rules: RiskRoutingRule[] } }>(BASE);
    return data.data.rules ?? [];
  },

  create: async (input: RoutingRuleInput): Promise<{ id: string }> => {
    const { data } = await apiClient.post<{ success: boolean; data: { id: string } }>(BASE, input);
    return data.data;
  },

  update: async (id: string, input: RoutingRuleInput): Promise<{ id: string }> => {
    const { data } = await apiClient.put<{ success: boolean; data: { id: string } }>(`${BASE}/${id}`, input);
    return data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}`);
  },
};
