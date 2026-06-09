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

export type TemplatePlaceholderKind = "party" | "date" | "currency" | "number" | "text";

export interface TemplatePlaceholder {
  key: string;
  labelEn: string;
  labelAr?: string | null;
  kind: TemplatePlaceholderKind;
  required: boolean;
}

export interface TemplateListItem {
  id: number;
  nameEn: string;
  nameAr: string | null;
  contractType: string;
  descriptionEn: string | null;
  descriptionAr?: string | null;
  language: "en" | "ar" | "bilingual";
  regulatoryTags: string[];
  regulatoryReference: string | null;
  usageCount: number;
  placeholderCount: number;
  updatedAt: string;
}

export interface TemplateDetail {
  id: number;
  nameEn: string;
  nameAr: string | null;
  contractType: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  language: "en" | "ar" | "bilingual";
  regulatoryTags: string[];
  regulatoryReference: string | null;
  placeholders: TemplatePlaceholder[];
  bodyEn: string | null;
  bodyAr: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDefaultClause {
  id: number;
  clauseId: number;
  sortOrder: number;
  isDefault: boolean;
  category: string;
  variant: "standard" | "alternative" | "fallback";
  titleEn: string;
  titleAr: string | null;
}

export interface TemplateDefaultClausesResult {
  templateId: number;
  data: TemplateDefaultClause[];
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
  // Mig 500 — last manual escalation event (null if never flagged).
  flaggedAt?: string | null;
  flaggedByName?: string | null;
  flaggedNote?: string | null;
}

export interface FlagObligationInput {
  note?: string | null;
}

export interface FlagObligationResult {
  eventId: number;
  roleCodes: string[];
  notifiedUserIds: number[];
  notificationCount: number;
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
  placeholders?: TemplatePlaceholder[];
  regulatoryReference?: string | null;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export interface ExtractTemplateFromContractInput {
  filename: string;
  extractedText: string;
  contractTypeHint?: string | null;
}

export interface ExtractTemplateFromContractResult {
  nameEn: string;
  descriptionEn: string;
  contractType: string;
  language: "en" | "ar" | "bilingual";
  bodyEnRedacted: string;
  placeholders: TemplatePlaceholder[];
  regulatoryReference: string | null;
  warnings: string[];
}

// ----------------------------------------------------------------------
// analyze-upload — fan-out of extract + similarity match (BE phase 2).
// ----------------------------------------------------------------------

export interface TemplateMatchRow {
  templateId: number;
  nameEn: string;
  nameAr: string | null;
  contractType: string;
  descriptionEn: string | null;
  /** Structure-only cosine similarity (0..1). */
  similarity: number;
  /**
   * v607 — composite score = 0.4×structure + 0.6×clauseCoverage. Only
   * populated on the TOP match row returned by /analyze-upload. FE
   * pill should render this when present, falling back to `similarity`.
   */
  compositeScore?: number | null;
  /** v607 — share of extracted clauses found in the library (0..1). */
  clauseCoverage?: number | null;
  /** v607 — total clauses extracted from the upload. Top row only. */
  clauseTotal?: number | null;
  /** v607 — number of those clauses found in the library. Top row only. */
  clauseKnown?: number | null;
  usageCount: number;
}

export interface ClauseCrossCheckRow {
  // Inherited candidate fields from the AI extractor:
  category: string;
  titleEn: string;
  titleAr: string | null;
  bodyEn: string;
  bodyAr: string | null;
  variant: "standard" | "alternative" | "fallback";
  legalCommentaryEn: string | null;
  regulatoryRefs: string[];
  // Match-side fields from fn_clause_library_match_each:
  bestSimilarity: number;
  bestMatchId: number | null;
  bestMatchTitle: string | null;
  bestMatchCategory: string | null;
  isNewToLibrary: boolean;
}

export type MatchClassification = "exact" | "extend_candidate" | "no_match";

export interface AnalyzeTemplateUploadResult {
  template: ExtractTemplateFromContractResult;
  templateMatches: TemplateMatchRow[];
  topMatchClassification: MatchClassification;
  thresholds: { exact: number; extend: number; clauseMatch: number };
  clauseCrossCheck: ClauseCrossCheckRow[];
  warnings: string[];
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
  defaultClauses: async (id: number): Promise<TemplateDefaultClausesResult> => {
    const { data } = await apiClient.get<TemplateDefaultClausesResult>(
      `/api/v1/templates/${id}/default-clauses`,
    );
    return data;
  },
  create: async (input: CreateTemplateInput): Promise<TemplateDetail> => {
    const { data } = await apiClient.post<TemplateDetail>("/api/v1/templates", input);
    return data;
  },
  update: async (id: number, input: UpdateTemplateInput): Promise<TemplateDetail> => {
    const { data } = await apiClient.patch<TemplateDetail>(`/api/v1/templates/${id}`, input);
    return data;
  },
  remove: async (id: number): Promise<{ id: number; deleted: boolean }> => {
    const { data } = await apiClient.delete<{ id: number; deleted: boolean }>(
      `/api/v1/templates/${id}`,
    );
    return data;
  },
  extractFromContract: async (
    input: ExtractTemplateFromContractInput,
  ): Promise<ExtractTemplateFromContractResult> => {
    // OpenAI extraction on a long contract body can take 30-60s. Override the
    // default 30s apiClient timeout so the FE waits long enough for the LLM.
    const { data } = await apiClient.post<ExtractTemplateFromContractResult>(
      "/api/v1/templates/extract-from-contract",
      input,
      { timeout: 120_000 },
    );
    return data;
  },
  // analyze-upload runs extract-template + extract-clauses + embedding match
  // in one call. Heavier than extract-from-contract (≥3 OpenAI calls) so the
  // timeout is generous.
  analyzeUpload: async (
    input: ExtractTemplateFromContractInput,
  ): Promise<AnalyzeTemplateUploadResult> => {
    const { data } = await apiClient.post<AnalyzeTemplateUploadResult>(
      "/api/v1/templates/analyze-upload",
      input,
      { timeout: 180_000 },
    );
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

export interface ExtractClausesFromContractInput {
  filename: string;
  extractedText: string;
}

export interface ClauseCandidate {
  category: string;
  titleEn: string;
  titleAr: string | null;
  bodyEn: string;
  bodyAr: string | null;
  variant: "standard" | "alternative" | "fallback";
  legalCommentaryEn: string | null;
  regulatoryRefs: string[];
}

export interface ExtractClausesFromContractResult {
  candidates: ClauseCandidate[];
  warnings: string[];
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
  extractFromContract: async (
    input: ExtractClausesFromContractInput,
  ): Promise<ExtractClausesFromContractResult> => {
    // gpt-4o-mini extraction on a long contract body can take 30-60s; override
    // the default 30s apiClient timeout the same way templates do.
    const { data } = await apiClient.post<ExtractClausesFromContractResult>(
      "/api/v1/clauses/extract-from-contract",
      input,
      { timeout: 120_000 },
    );
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
  flag: async (
    id: number,
    input: FlagObligationInput = {},
  ): Promise<FlagObligationResult> => {
    const { data } = await apiClient.post<FlagObligationResult>(
      `/api/v1/obligations/${id}/flag`,
      input,
    );
    return data;
  },
};
