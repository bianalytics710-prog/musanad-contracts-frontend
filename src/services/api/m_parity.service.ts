/**
 * M_parity FE service — read-only thin axios wrappers for the 4 entities
 * introduced in BE migration 058. Mirrors the BE shape exactly.
 */
import { apiClient } from "@/lib/api-client";
import type {
  PartyDetail as PartyDetailExtended,
  PartyUpdatePayload,
} from "@/types/entities/party-graph.types";

export interface PaginatedResult<T> {
  data: T[];
  pagination: { total: number; limit: number; offset: number };
}

export interface PartyListItem {
  id: number;
  partyType: "individual" | "company";
  nameEn: string;
  nameAr: string | null;
  tradeLicenseNumber: string | null;
  tradeLicenseIssuer: string | null;
  emirate: string | null;
  freeZone: string | null;
  country: string;
  contactEmail: string | null;
  contactPhone: string | null;
  isVerified?: boolean;
  createdAt: string;
}

export interface PartyDetail extends PartyListItem {
  registeredAddress: string | null;
  notes: string | null;
  updatedAt: string;
  recentContracts5: Array<{
    id: number;
    contractNumber: string;
    titleEn: string;
    status: string;
    valueAed: number | null;
    updatedAt: string;
  }>;
}

export interface TemplateListItem {
  id: number;
  nameEn: string;
  nameAr: string | null;
  contractType: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  language: "en" | "ar" | "bilingual";
  regulatoryTags: string[];
  usageCount: number;
  createdAt: string;
}

export interface TemplateDetail extends TemplateListItem {
  bodyEn: string | null;
  bodyAr: string | null;
  updatedAt: string;
}

export interface ClauseListItem {
  id: number;
  category: string;
  titleEn: string;
  titleAr: string | null;
  variant: "standard" | "alternative" | "fallback";
  regulatoryRefs: string[];
  usageCount: number;
  createdAt: string;
}

export interface ClauseDetail extends ClauseListItem {
  bodyEn: string;
  bodyAr: string | null;
  legalCommentaryEn: string | null;
  legalCommentaryAr: string | null;
  updatedAt: string;
}

export interface ObligationListItem {
  id: number;
  contractId: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  descriptionEn: string | null;
  obligationType: string;
  dueDate: string | null;
  recurrence: string;
  responsibleParty: string;
  assigneeUserId: number | null;
  status: "open" | "in_progress" | "completed" | "overdue" | "waived";
  completedAt: string | null;
  createdAt: string;
}

export interface CreatePartyInput {
  partyType: "individual" | "company";
  nameEn: string;
  nameAr?: string | null;
  tradeLicenseNumber?: string | null;
  tradeLicenseIssuer?: string | null;
  emirate?: string | null;
  freeZone?: string | null;
  country?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  registeredAddress?: string | null;
  notes?: string | null;
}

export const partiesService = {
  list: async (params: {
    partyType?: string;
    q?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<PartyListItem>> => {
    const { data } = await apiClient.get<PaginatedResult<PartyListItem>>(
      "/api/v1/parties",
      { params },
    );
    return data;
  },
  getById: async (id: number): Promise<PartyDetail> => {
    const { data } = await apiClient.get<PartyDetail>(`/api/v1/parties/${id}`);
    return data;
  },
  create: async (input: CreatePartyInput): Promise<PartyDetail> => {
    const { data } = await apiClient.post<PartyDetail>("/api/v1/parties", input);
    return data;
  },
  /**
   * M9 (CR-B) — PATCH /api/v1/parties/:id (fn_party_update).
   *
   * Editable subset only. sanctions_* fields are silently ignored even if
   * forwarded (Q-DA4 lock — defence in depth alongside the BE controller).
   * The response is the full PartyDetail SUPERSET shape (Migration 120).
   *
   * parentId/uboId convention: undefined = leave alone, null = explicit
   * unset (BE controller maps null → -1 sentinel).
   */
  updateExtended: async (
    id: number,
    payload: PartyUpdatePayload,
  ): Promise<PartyDetailExtended> => {
    const { data } = await apiClient.patch<PartyDetailExtended>(
      `/api/v1/parties/${id}`,
      payload,
    );
    return data;
  },
};

export interface CreateTemplateInput {
  nameEn: string;
  contractType: string;
  language?: "en" | "ar" | "bilingual";
  nameAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  bodyEn?: string | null;
  bodyAr?: string | null;
  regulatoryTags?: string[];
}

export const templatesService = {
  list: async (params: {
    contractType?: string;
    q?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<TemplateListItem>> => {
    const { data } = await apiClient.get<PaginatedResult<TemplateListItem>>(
      "/api/v1/templates",
      { params },
    );
    return data;
  },
  getById: async (id: number): Promise<TemplateDetail> => {
    const { data } = await apiClient.get<TemplateDetail>(
      `/api/v1/templates/${id}`,
    );
    return data;
  },
  create: async (input: CreateTemplateInput): Promise<TemplateDetail> => {
    const { data } = await apiClient.post<TemplateDetail>("/api/v1/templates", input);
    return data;
  },
};

export interface CreateClauseInput {
  category: string;
  titleEn: string;
  bodyEn: string;
  variant?: "standard" | "alternative" | "fallback";
  titleAr?: string | null;
  bodyAr?: string | null;
  legalCommentaryEn?: string | null;
  legalCommentaryAr?: string | null;
  regulatoryRefs?: string[];
}

export const clausesService = {
  list: async (params: {
    category?: string;
    variant?: string;
    q?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<ClauseListItem>> => {
    const { data } = await apiClient.get<PaginatedResult<ClauseListItem>>(
      "/api/v1/clauses",
      { params },
    );
    return data;
  },
  getById: async (id: number): Promise<ClauseDetail> => {
    const { data } = await apiClient.get<ClauseDetail>(
      `/api/v1/clauses/${id}`,
    );
    return data;
  },
  create: async (input: CreateClauseInput): Promise<ClauseDetail> => {
    const { data } = await apiClient.post<ClauseDetail>("/api/v1/clauses", input);
    return data;
  },
};

export interface CreateObligationInput {
  contractId: number;
  titleEn: string;
  obligationType: "payment" | "delivery" | "reporting" | "renewal" | "compliance" | "notice" | "other";
  dueDate?: string | null;
  recurrence?: "once" | "monthly" | "quarterly" | "annually";
  responsibleParty?: "our_party" | "counterparty" | "both";
  titleAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  assigneeUserId?: number | null;
  status?: "open" | "in_progress" | "completed" | "overdue" | "waived";
}

export const obligationsService = {
  list: async (params: {
    status?: string;
    assigneeUserId?: number | "me";
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<ObligationListItem>> => {
    const { data } = await apiClient.get<PaginatedResult<ObligationListItem>>(
      "/api/v1/obligations",
      { params },
    );
    return data;
  },
  create: async (input: CreateObligationInput): Promise<ObligationListItem> => {
    const { data } = await apiClient.post<ObligationListItem>("/api/v1/obligations", input);
    return data;
  },
};
