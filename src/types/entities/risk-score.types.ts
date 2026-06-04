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
  /** Human rule name from correlation_rule.name. Mig 528+. */
  ruleName?: string;
  ruleNameAr?: string | null;
  /** Scenario bucket — sanctions, esg, hormuz, brent, etc. Mig 528+. */
  scenario?: string | null;
  probability: number;
  impactMultiplier: number;
  marContribution: string | null;
  dimensionsAffected: string[];
  // W6 follow-up: surface base factors (contract value × exposure fraction)
  // so the FE MaR formula panel can show all 4 BRD §11.3 factors. Both
  // optional because older snapshots predate this addition.
  contractValue?: string | null;
  exposureFraction?: number | null;
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
  /** Mig 529+ — severity band from the underlying osint_signal (critical/high/medium/low/informational). */
  severity?: string | null;
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

/** Mig 529+ — single named addend that contributed to the risk score. */
export interface RiskScoreAddend {
  /** A | B | C | D | E — bucket the addend belongs to. */
  bucket: string;
  /** Short human label, e.g. "Value tier — AED 5M to 50M". */
  label: string;
  /** Points contributed by this addend. */
  points: number;
  /** Long-form detail: the actual numbers behind the points (confidence x reliability x severity, etc.). */
  detail: string;
  /** Optional rule/correlation cross-ref when bucket = 'A'. */
  correlationId?: string;
  ruleId?: string;
}

export interface RiskScoreExplainResponse {
  riskScoreId: string;
  contractId: string;
  healthScore: number;
  /** One-sentence plain-English summary of why the score is where it is. Mig 528+. */
  narrative?: string;
  /** Mig 529+ — additive formula breakdown, one row per scoring addend. */
  addends?: RiskScoreAddend[];
  /** Mig 529+ — per-bucket subtotals (A, B, C, D, E) → number. */
  bucketSubtotals?: Record<string, number>;
  /** Mig 529+ — band thresholds used to color the gauge. */
  bands?: { lowMax: number; mediumMax: number };
  /** Mig 529+ — "Low" | "Medium" | "High" derived from healthScore vs bands. */
  band?: 'Low' | 'Medium' | 'High';
  /** Mig 529+ — "v1" or "v2". v2 means the explanation carries addends[]. */
  formulaVersion?: 'v1' | 'v2';
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
