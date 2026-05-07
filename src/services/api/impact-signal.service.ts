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

export interface ImpactSignalAiExplainResponse {
  summary: string;
  whyItMatters: string;
  perContractImpacts: Array<{
    contractId: number;
    contractNumber: string;
    explanation: string;
  }>;
}

export interface ImpactSignalAiAmendmentResponse {
  amendmentSnippets: Array<{
    clauseAnchor: string;
    rationale: string;
    suggestedText: string;
  }>;
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
  explainWithAi: async (
    id: number,
    language: "en" | "ar" = "en",
  ): Promise<ImpactSignalAiExplainResponse> => {
    const { data } = await apiClient.post<{ data: ImpactSignalAiExplainResponse }>(
      `/api/v1/ai/impact-signals/${id}/explain`,
      { language },
    );
    return data.data;
  },
  suggestAmendment: async (
    id: number,
    opts: { language?: "en" | "ar"; contractId?: number } = {},
  ): Promise<ImpactSignalAiAmendmentResponse> => {
    const { data } = await apiClient.post<{ data: ImpactSignalAiAmendmentResponse }>(
      `/api/v1/ai/impact-signals/${id}/suggest-amendment`,
      { language: opts.language ?? "en", ...(opts.contractId ? { contractId: opts.contractId } : {}) },
    );
    return data.data;
  },
};
