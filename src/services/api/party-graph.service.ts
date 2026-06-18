/**
 * Party Graph (M9 / CR-B) FE service. Wraps:
 *
 *   GET    /api/v1/parties/:id/relationships
 *   POST   /api/v1/parties/:id/relationships
 *   PATCH  /api/v1/parties/:id/relationships/:relId
 *   DELETE /api/v1/parties/:id/relationships/:relId
 *   GET    /api/v1/parties/:id/chain
 *   GET    /api/v1/parties/:id/chain-summary
 *   POST   /api/v1/admin/parties/sanctions-match
 *
 * Per R-PA7 lesson A7: every apiClient call lives in this service file —
 * never imported into pages, components, or hooks.
 */
import { apiClient } from "@/lib/api-client";
import type {
  ChainDirection,
  CreateRelationshipPayload,
  DeleteRelationshipResponse,
  ListRelationshipsResponse,
  PartyChainSummary,
  PartyChainTraverseResponse,
  PartyRelationship,
  PartySanctionsMatchInput,
  PartySanctionsMatchResponse,
  UpdateRelationshipPayload,
} from "@/types/entities/party-graph.types";

export interface ChainQueryParams {
  direction?: ChainDirection;
  /** 1..10 inclusive, default 5 (per AC-S5-04 / AC-S6-03). */
  maxDepth?: number;
}

export interface ChainSummaryQueryParams {
  /** 1..10 inclusive, default 5. */
  maxDepth?: number;
}

// ─── Counterparty drafting/review intelligence (mig 707) ──────────────────
export interface PartyIntelligenceMetrics {
  party: { id: number; nameEn: string | null; nameAr: string | null };
  priorContracts: number;
  activeContracts: number;
  avgVersions: number | null;
  portfolioAvgVersions: number | null;
  approvalFriction: { rejected: number; resubmitted: number };
  avgNegotiationDays: number | null;
  riskCases: {
    total: number;
    open: number;
    byType: Array<{ type: string; n: number }>;
  };
  topRedlineClauses: Array<{ heading: string; n: number }>;
  // Drill-down lists (mig 708) — the rows behind each tile.
  contracts: Array<{
    id: number;
    contractNumber: string;
    title: string;
    status: string;
    valueAed: number | null;
    versions: number;
    signedAt: string | null;
    createdAt: string;
  }>;
  sentBack: Array<{
    contractId: number;
    contractNumber: string;
    title: string;
    action: "rejected" | "resubmission_requested";
    role: string | null;
    decidedAt: string | null;
  }>;
  riskCaseList: Array<{
    id: number;
    title: string;
    caseType: string;
    priority: string;
    status: string;
    open: boolean;
    contractId: number;
    contractNumber: string;
    createdAt: string;
  }>;
}

export interface PartyIntelligenceResponse {
  metrics: PartyIntelligenceMetrics;
  summary: string | null;
}

export const partyGraphService = {
  // ─── Relationships CRUD ─────────────────────────────────────────────────

  listRelationships: async (
    partyId: number,
  ): Promise<ListRelationshipsResponse> => {
    const { data } = await apiClient.get<ListRelationshipsResponse>(
      `/api/v1/parties/${partyId}/relationships`,
    );
    return data;
  },

  createRelationship: async (
    partyId: number,
    payload: CreateRelationshipPayload,
  ): Promise<PartyRelationship> => {
    const { data } = await apiClient.post<PartyRelationship>(
      `/api/v1/parties/${partyId}/relationships`,
      payload,
    );
    return data;
  },

  updateRelationship: async (
    partyId: number,
    relId: number,
    payload: UpdateRelationshipPayload,
  ): Promise<PartyRelationship> => {
    const { data } = await apiClient.patch<PartyRelationship>(
      `/api/v1/parties/${partyId}/relationships/${relId}`,
      payload,
    );
    return data;
  },

  deleteRelationship: async (
    partyId: number,
    relId: number,
  ): Promise<DeleteRelationshipResponse> => {
    const { data } = await apiClient.delete<DeleteRelationshipResponse>(
      `/api/v1/parties/${partyId}/relationships/${relId}`,
    );
    return data;
  },

  // ─── Chain traversal ────────────────────────────────────────────────────

  getChain: async (
    partyId: number,
    params: ChainQueryParams = {},
  ): Promise<PartyChainTraverseResponse> => {
    const { data } = await apiClient.get<PartyChainTraverseResponse>(
      `/api/v1/parties/${partyId}/chain`,
      { params },
    );
    return data;
  },

  getChainSummary: async (
    partyId: number,
    params: ChainSummaryQueryParams = {},
  ): Promise<PartyChainSummary> => {
    const { data } = await apiClient.get<PartyChainSummary>(
      `/api/v1/parties/${partyId}/chain-summary`,
      { params },
    );
    return data;
  },

  // ─── Sanctions match (admin) ────────────────────────────────────────────

  sanctionsMatch: async (
    payload: PartySanctionsMatchInput,
  ): Promise<PartySanctionsMatchResponse> => {
    const { data } = await apiClient.post<PartySanctionsMatchResponse>(
      "/api/v1/admin/parties/sanctions-match",
      payload,
    );
    return data;
  },

  // ─── Drafting/review intelligence ───────────────────────────────────────

  getIntelligence: async (
    partyId: number,
    opts: { excludeContractId?: number; lang?: string } = {},
  ): Promise<PartyIntelligenceResponse> => {
    const { data } = await apiClient.get<PartyIntelligenceResponse>(
      `/api/v1/parties/${partyId}/intelligence`,
      { params: opts },
    );
    return data;
  },
};
