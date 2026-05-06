/**
 * R-LC7 — Impact Watch service.
 */
import { apiClient } from "@/lib/api-client";

export type ImpactCategory =
  | "regulatory"
  | "commodity_prices"
  | "supply_chain"
  | "geopolitical"
  | "market_financial";

export interface ImpactSignalListItem {
  id: number;
  extId: string;
  category: ImpactCategory;
  source: string;
  severity: string;
  titleEn: string;
  titleAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  affectedClauseCategories: string[];
  publishedDate: string;
  effectiveDate: string | null;
  complianceDeadline: string | null;
  impactedContractCount: number;
  createdAt: string;
}

export interface ImpactSignalContract {
  id: number;
  contractId: number;
  contractNumber: string;
  titleEn: string;
  impactScore: number;
  status: "pending" | "reviewed" | "amended" | "dismissed";
  reviewedAt: string | null;
}

export interface ImpactSignalDetail extends ImpactSignalListItem {
  impactedContracts: ImpactSignalContract[];
  updatedAt: string;
}

export interface ImpactSignalListResponse {
  data: ImpactSignalListItem[];
  pagination: { total: number; limit: number; offset: number };
}

export const impactSignalService = {
  list: async (params: {
    category?: ImpactCategory;
    severity?: string;
    q?: string;
  } = {}): Promise<ImpactSignalListResponse> => {
    const { data } = await apiClient.get<ImpactSignalListResponse>(
      "/api/v1/impact-signals",
      { params },
    );
    return data;
  },
  getById: async (id: number): Promise<ImpactSignalDetail> => {
    const { data } = await apiClient.get<ImpactSignalDetail>(`/api/v1/impact-signals/${id}`);
    return data;
  },
  markReviewed: async (linkId: number): Promise<{ id: number; status: string }> => {
    const { data } = await apiClient.post(`/api/v1/impact-signals/links/${linkId}/review`);
    return data;
  },
  notifyDrafters: async (id: number): Promise<{ signalId: number; notified: number }> => {
    const { data } = await apiClient.post(`/api/v1/impact-signals/${id}/notify-drafters`);
    return data;
  },
  bulkAmend: async (id: number): Promise<{ signalId: number; amended: number }> => {
    const { data } = await apiClient.post(`/api/v1/impact-signals/${id}/bulk-amend`);
    return data;
  },
};
