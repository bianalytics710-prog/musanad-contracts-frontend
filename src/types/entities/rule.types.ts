/**
 * M13 / CR-E — Correlation Rule Engine Types.
 * Derived from workspace/current-module/types.ts (Sections 5–9).
 */

import type { ClauseTypeV2 } from './clause.types';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CorrelationRuleMeta {
  owner: string;
  lastReviewed: string;
  rationale: string;
  evaluationTimeoutSecondsOverride?: number;
}

export interface CorrelationRuleFixtureSummary {
  id: number;
  fixtureId: string;
  description: string;
  expectedMatch: boolean;
}

export interface CorrelationRule {
  id: number;
  tenantId: string;
  ruleId: string;
  name: string;
  nameAr: string;
  scenario: string | null;
  enabled: boolean;
  meta: CorrelationRuleMeta;
  matchYaml: string;
  produceYaml: string;
  versionHash: string;
  lastReviewedBy: number | null;
  lastReviewedByName: string | null;
  lastReviewedAt: string | null;
  dataClassification: 'demo' | 'pilot' | 'production';
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
  isActive: boolean;
  fixtures?: CorrelationRuleFixtureSummary[];
}

export interface CorrelationRuleListItem {
  id: number;
  ruleId: string;
  name: string;
  nameAr: string;
  scenario: string | null;
  enabled: boolean;
  lastReviewedAt: string | null;
  versionHashShort: string;
  versionHash: string;
  updatedAt: string;
}

export interface CorrelationRuleListResponse {
  items: CorrelationRuleListItem[];
  pagination: PaginationMeta;
}

export interface CreateCorrelationRuleDto {
  ruleId: string;
  name: string;
  nameAr: string;
  scenario?: string;
  enabled?: boolean;
  meta?: Partial<CorrelationRuleMeta>;
  matchYaml: string;
  produceYaml: string;
}

export interface UpdateCorrelationRuleDto {
  name?: string;
  nameAr?: string;
  scenario?: string;
  enabled?: boolean;
  meta?: Partial<CorrelationRuleMeta>;
  matchYaml?: string;
  produceYaml?: string;
}

export type CorrelationStatus = 'active' | 'dismissed' | 'expired';

export interface MatchEvidence {
  signalId?: number;
  signalUrl?: string;
  sdnEntry?: string;
  counterpartyId?: number;
  clauseId?: number;
  [key: string]: unknown;
}

export interface MatchEntityRef {
  id: string | number;
  name: string;
  kind: string;
  designationSource?: string;
  chainDepth?: number;
}

export interface Correlation {
  id: number;
  tenantId: string;
  signalId: number;
  contractId: number;
  contractTitleEn?: string;
  contractTitleAr?: string;
  ruleId: string;
  ruleName?: string;
  ruleScenario?: string;
  ruleVersionHash: string;
  confidence: number;
  matchReason: string;
  matchEvidence: MatchEvidence;
  matchGeographies: string[];
  matchEntities: MatchEntityRef[];
  status: CorrelationStatus;
  dismissedBy: number | null;
  dismissedAt: string | null;
  dismissedReason: string | null;
  expiresAt: string | null;
  dataClassification: 'demo' | 'pilot' | 'production';
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
  isActive: boolean;
}

export interface CorrelationListResponse {
  items: Correlation[];
  pagination: PaginationMeta;
}

export interface CorrelationDismissRequest {
  reason: string;
}

export interface CorrelationDismissResult {
  correlationId: number;
  newStatus: 'dismissed';
}

export interface RuleTestAgainstFixtureRequest {
  fixtureId?: string;
}

export interface RuleTestAgainstFixtureResult {
  ruleId: string;
  fixtureId: string;
  expectedMatch: boolean;
  actualMatch: boolean;
  matchEvidence?: MatchEvidence;
  matchReason?: string;
  diffNotes?: string[];
  passed: boolean;
  durationMs?: number;
}

// Re-export ClauseTypeV2 for use in ContractPredicates
export type { ClauseTypeV2 };
