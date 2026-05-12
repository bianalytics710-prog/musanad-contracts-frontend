/**
 * M12 / CR-D — Clause Taxonomy + Extraction Types.
 * Derived from workspace/current-module/types.ts (Sections 1–4).
 */

export type ClauseFamily =
  | 'force_majeure'
  | 'termination'
  | 'pricing'
  | 'performance'
  | 'indemnity'
  | 'compliance'
  | 'governance'
  | 'operational';

export type ClauseTypeV2 =
  | 'force_majeure' | 'hardship' | 'excusable_delay' | 'weather_downtime'
  | 'epidemic_pandemic' | 'government_action' | 'sanctions_disruption' | 'strike_lockout'
  | 'termination_for_convenience' | 'termination_for_cause' | 'suspension'
  | 'step_in_rights' | 'termination_for_change_of_control' | 'prolonged_force_majeure_termination'
  | 'price_review' | 'price_indexation' | 'escalation' | 'most_favoured_pricing' | 'take_or_pay'
  | 'sla_performance' | 'liquidated_damages' | 'cure_period' | 'performance_bond_guarantee'
  | 'key_personnel' | 'acceptance_testing'
  | 'indemnity' | 'liability_cap' | 'consequential_loss_exclusion' | 'insurance' | 'mutual_hold_harmless'
  | 'sanctions_compliance' | 'anti_bribery_corruption' | 'hse_compliance' | 'icv_in_country_value'
  | 'data_protection' | 'environmental' | 'export_control' | 'regulatory_change'
  | 'governing_law' | 'dispute_resolution' | 'notices' | 'entire_agreement' | 'severability'
  | 'term_and_renewal' | 'assignment_novation' | 'change_order_variation' | 'audit_rights'
  | 'confidentiality' | 'ip_rights' | 'subcontracting';

export interface ClauseTaxonomyParameterDef {
  type:
    | 'date' | 'duration_days' | 'money' | 'percentage' | 'party_ref'
    | 'address' | 'jurisdiction' | 'index_marker' | 'enum' | 'enum_list'
    | 'text_excerpt' | 'boolean' | 'integer' | 'text';
  required: boolean;
  enum_values?: string[];
}

export type ClauseTaxonomyParameterSchema = Record<string, ClauseTaxonomyParameterDef>;

export interface ClauseTaxonomyEntry {
  id: number;
  clauseTypeId: ClauseTypeV2;
  family: ClauseFamily;
  displayNameEn: string;
  displayNameAr: string;
  definitionEn: string;
  definitionAr: string;
  identificationCuesEn: string;
  identificationCuesAr: string;
  parameterSchema: ClauseTaxonomyParameterSchema;
  version: number;
  isDeprecated: boolean;
  dataClassification: 'demo' | 'pilot' | 'production';
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
  isActive: boolean;
}

export interface ClauseTaxonomyListResponse {
  items: ClauseTaxonomyEntry[];
  groupedByFamily: Record<ClauseFamily, ClauseTaxonomyEntry[]>;
}

export type ClauseReviewStatus =
  | 'auto' | 'pending_review' | 'reviewed' | 'rejected' | 'pending_extraction';

export interface ClauseReviewQueueItem {
  id: number;
  contractId: number;
  contractTitleEn: string;
  contractTitleAr: string;
  clauseTypeV2: ClauseTypeV2;
  family: ClauseFamily;
  displayNameEn: string;
  displayNameAr: string;
  parametersPreview: Record<string, unknown>;
  confidence: number | null;
  pageNo: number | null;
  reviewStatus: ClauseReviewStatus;
  createdAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClauseReviewQueueListResponse {
  items: ClauseReviewQueueItem[];
  pagination: PaginationMeta;
}

export type ClauseReviewAction = 'confirm' | 'correct' | 'reject';

export interface ClauseReviewResolveRequest {
  action: ClauseReviewAction;
  parametersCorrection?: Record<string, unknown>;
  textExcerptsCorrection?: Record<string, string>;
}

export interface ClauseReviewResolveResult {
  clauseId: number;
  newReviewStatus: ClauseReviewStatus;
  obligationsRecomputed: boolean;
}

export interface ClauseSemanticSearchRequest {
  queryText: string;
  contractId?: number;
  limit?: number;
  similarityMin?: number;
}

export interface ClauseSemanticSearchResult {
  clauseId: number;
  contractId: number;
  clauseTypeV2: ClauseTypeV2;
  family: ClauseFamily;
  similarity: number;
  summaryEn: string | null;
  summaryAr: string | null;
  pageNo: number | null;
}

export interface ClauseSemanticSearchResponse {
  data: ClauseSemanticSearchResult[];
  count: number;
  queryEmbeddingLogId?: number;
}

export interface ClauseExtractionRequestResult {
  queued: boolean;
  extractionRunId: number | null;
  reason?: string;
}
