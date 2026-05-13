/**
 * M14 — CR-F — 5-Dim Risk Scoring + MaR + AVaR
 * FE Entity Types — mirrors types.ts from Agent 5 (Contract Generator).
 *
 * SENSITIVE fields (contributingCorrelations, explanation) — never log,
 * never surface in error messages (T13).
 */

// ── Module-level constants ────────────────────────────────────────────────────

export const CR_F_PERMISSIONS_CODES = [
  'score.read',
  'score.weights.manage',
  'risk.acknowledge',
] as const;

export type CrFPermissionCode = typeof CR_F_PERMISSIONS_CODES[number];

export const RISK_SCORE_TRIGGERED_BY_VALUES = [
  'signal',
  'clause_change',
  'weight_change',
  'scheduled',
  'manual',
  'bootstrap',
] as const;

export type RiskScoreTriggeredBy = typeof RISK_SCORE_TRIGGERED_BY_VALUES[number];

export const RISK_SCORE_DATA_CLASSIFICATION_VALUES = [
  'demo',
  'pilot',
  'production',
] as const;

export type RiskScoreDataClassification = typeof RISK_SCORE_DATA_CLASSIFICATION_VALUES[number];

export const AVAR_GROUP_BY_VALUES = [
  'business_unit',
  'counterparty_id',
  'counterparty_chain',
  'geography',
  'risk_kind',
] as const;

export type AvarGroupBy = typeof AVAR_GROUP_BY_VALUES[number];

// ── Dimension breakdown ───────────────────────────────────────────────────────

export interface RiskScoreDimensionBreakdown {
  score: number;
  probability: number;
  impact: number;
  reasons: string[];
}

export interface MarFormulaBreakdown {
  contractValue: string | null;
  exposureFraction: number;
  probability: null;
  impactMultiplier: null;
  marValue: string | null;
}

export interface WeightsAtCalculation {
  legal: number;
  financial: number;
  operational: number;
  reputational: number;
  compliance: number;
}

export interface RiskScoreExplanation {
  dimensions: {
    legal: RiskScoreDimensionBreakdown;
    financial: RiskScoreDimensionBreakdown;
    operational: RiskScoreDimensionBreakdown;
    reputational: RiskScoreDimensionBreakdown;
    compliance: RiskScoreDimensionBreakdown;
  };
  marFormula: MarFormulaBreakdown;
  weightsAtCalculation: WeightsAtCalculation;
  contributingClauses: string[];
}

// SENSITIVE — redacted in audit_log
export interface ContributingCorrelation {
  correlationId: string;
  ruleId: string;
  probability: number;
  impactMultiplier: number;
  marContribution: string | null;
  dimensionsAffected: string[];
}

// ── RiskScore table row ───────────────────────────────────────────────────────

export interface RiskScore {
  id: string;
  tenantId: string;
  contractId: string;
  healthScore: number;
  dimLegal: number;
  dimFinancial: number;
  dimOperational: number;
  dimReputational: number;
  dimCompliance: number;
  marValue: string | null;
  marCurrency: 'AED';
  contributingCorrelations: ContributingCorrelation[];
  explanation: RiskScoreExplanation;
  weightsVersion: string;
  calculatedAt: string;
  triggeredBy: RiskScoreTriggeredBy;
  dataClassification: RiskScoreDataClassification;
  createdAt: string;
  createdBy: string | null;
}

// ── fn_risk_score_explain return ─────────────────────────────────────────────

export interface HydratedContributingCorrelation extends ContributingCorrelation {
  ruleVersionHash: string | null;
  confidence: number;
  matchReason: string | null;
  status: string;
  sourceReliability: number;
  signal: {
    id: string;
    titleEn: string | null;
    titleAr: string | null;
    signalKind: string | null;
    occurredAt: string | null;
  };
  matchedClause: {
    id: string;
    clauseTypeV2: string | null;
    snippet: string | null;
  } | null;
}

export interface RiskScoreExplainResponse {
  riskScoreId: string;
  contractId: string;
  healthScore: number;
  dimensions: {
    legal: RiskScoreDimensionBreakdown;
    financial: RiskScoreDimensionBreakdown;
    operational: RiskScoreDimensionBreakdown;
    reputational: RiskScoreDimensionBreakdown;
    compliance: RiskScoreDimensionBreakdown;
  };
  marFormula: MarFormulaBreakdown;
  marValue: string | null;
  marCurrency: 'AED';
  weightsVersion: string;
  weightsAtCalculation: WeightsAtCalculation;
  contributingCorrelations: HydratedContributingCorrelation[];
  calculatedAt: string;
  triggeredBy: RiskScoreTriggeredBy;
}

// ── fn_risk_score_history return ──────────────────────────────────────────────

export interface RiskScoreHistorySnapshot {
  riskScoreId: string;
  calculatedAt: string;
  healthScore: number;
  dimLegal: number;
  dimFinancial: number;
  dimOperational: number;
  dimReputational: number;
  dimCompliance: number;
  marValue: string | null;
  marCurrency: 'AED';
  triggeredBy: RiskScoreTriggeredBy;
  weightsVersion: string;
}

export interface RiskScoreHistoryResponse {
  contractId: string;
  windowDays: number;
  snapshots: RiskScoreHistorySnapshot[];
  count: number;
}

// ── fn_avar_aggregate return ──────────────────────────────────────────────────

export interface AvarBreakdownBucket {
  key: string;
  label: string;
  avar: string | null;
  contractCount: number;
  pctOfTotal: number | null;
}

export interface AvarDeltaVsPriorWindow {
  priorAvar: string;
  deltaAed: string;
  deltaPct: number | null;
}

export interface AvarFilters {
  businessUnit?: string;
  counterpartyId?: string;
  counterpartyChainRootId?: string;
  geography?: string;
  riskKind?: string;
  groupBy?: AvarGroupBy;
  windowDays?: number;
}

export interface AvarAggregateResponse {
  totalAvar: string;
  currency: 'AED';
  contractCount: number;
  windowDays: number;
  groupBy: AvarGroupBy;
  noValueCount: number;
  breakdown: AvarBreakdownBucket[];
  deltaVsPriorWindow: AvarDeltaVsPriorWindow;
}

// ── Scoring weights types ─────────────────────────────────────────────────────

export interface ScoringWeightsCurrent {
  legal: number;
  financial: number;
  operational: number;
  reputational: number;
  compliance: number;
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ScoringWeightsHistoryEntry {
  version: string;
  changedAt: string;
  changedById: string | null;
}

export interface ScoringWeightsGetResponse {
  current: ScoringWeightsCurrent;
  history: ScoringWeightsHistoryEntry[];
  exposureFractionDefaults: Record<string, number>;
  impactMultipliers: Record<string, number>;
}

export interface ScoringWeightsUpdateRequest {
  legal: number;
  financial: number;
  operational: number;
  reputational: number;
  compliance: number;
}

export interface ScoringWeightsSetResponse {
  newVersion: string;
  weightsApplied: ScoringWeightsCurrent;
  totalSum: number;
}

// ── fn_score_recompute_for_weight_change return ───────────────────────────────

export interface ScoreRecomputeForWeightChangeResult {
  weightsVersion: string;
  totalContractsTargeted: number;
  recomputedCount: number;
  failedContractIds: string[];
  elapsedMs: number;
}

// ── BE API response envelope aliases ─────────────────────────────────────────

export type ContractRiskScoreResponse = RiskScoreExplainResponse;
export type ContractRiskScoreHistoryResponse = RiskScoreHistoryResponse;
export type RiskAvarResponse = AvarAggregateResponse;
export type AdminScoringWeightsGetResponse = ScoringWeightsGetResponse;
export type AdminScoringWeightsPatchResponse = ScoringWeightsSetResponse;
export type AdminScoringWeightsRecomputeAllResponse = ScoreRecomputeForWeightChangeResult;
