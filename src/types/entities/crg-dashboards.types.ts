/**
 * M15 / CR-G — Entity types for 4 new persona dashboards + Executive extension.
 *
 * Re-exports from the canonical Agent 5 types.ts output.
 * Import from this file (not directly from workspace types.ts) so the
 * type path remains stable across module boundaries.
 *
 * Types covered:
 *   - ExecutiveDashboardCrgAdditions (3 new executive sections)
 *   - WhatChangedTodayRow / RecommendedActionRow / ClausesTriggeredPayload / ClausesTriggeredRow
 *   - OperationsDashboardResponse + subtypes
 *   - FinanceTreasuryDashboardResponse + subtypes
 *   - ComplianceEsgDashboardResponse + subtypes
 *   - ProcurementSupplierRiskDashboardResponse + subtypes
 *   - DashboardWindowQueryCrg
 *   - CR_G_PERMISSION_CODES / CrgPermissionCode
 */

// ─── Executive extension ─────────────────────────────────────────────────────

export interface WhatChangedTodayRow {
  correlationId: string;
  contractId: string;
  ruleId: string;
  headline: string;
  scenario?: string | null;
  marAed: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  occurredAt: string;
}

export interface RecommendedActionRow {
  correlationId: string;
  contractId: string;
  ruleId?: string;
  action: string | null;
  assignedRoles: string[];
  slaHours: number | null;
  marAed: string;
}

export interface ClausesTriggeredRow {
  clauseFamily: string;
  clauseType: string;
  count: number;
  contractsAffected: number;
  totalMarAed: string;
}

export interface ClausesTriggeredPayload {
  last7d: ClausesTriggeredRow[];
  last30d: ClausesTriggeredRow[];
}

export interface ExecutiveDashboardCrgAdditions {
  whatChangedToday: WhatChangedTodayRow[];
  recommendedActions: RecommendedActionRow[];
  clausesTriggered: ClausesTriggeredPayload;
}

// ─── Operations dashboard ────────────────────────────────────────────────────

export interface OperationsKpi {
  openSlaBreaches: number;
  openSlaBreachesMarAed: string;
  deliveryDelaysCount: number;
  contractPenaltyExposureAed: string;
  vendorsWithBreaches: number;
}

export interface SlaBreachRow {
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  counterpartyName: string;
  breachKind: string;
  signalId: string;
  occurredAt: string;
  severity: string;
  marAed: string;
}

export interface DeliveryDelayRow {
  contractId: string;
  contractNumber: string;
  counterpartyName: string;
  lastDelayedMilestone: string | null;
  delayDays: number | null;
  signalCount180d: number;
  severity: string;
}

export interface PenaltyExposureRow {
  contractId: string;
  contractNumber: string;
  counterpartyName: string;
  penaltyClauseSummary: string;
  exposureAed: string;
}

export interface OpsEventRow {
  eventType: string;
  contractId: string;
  counterpartyName: string;
  headline: string;
  occurredAt: string;
  severity: string;
  sourceRef: string | null;
}

export interface VendorScorecardRow {
  counterpartyId: string;
  counterpartyName: string;
  slaBreachCount180d: number;
  deliveryDelayCount180d: number;
  riskScore: number;
  performanceTier: 'high' | 'medium' | 'low';
}

export interface OperationsDashboardResponse {
  windowDays: number;
  asOf: string;
  kpi: OperationsKpi;
  kpiPrev?: OperationsKpi;
  slaBreachesList: SlaBreachRow[];
  deliveryDelayTracker: DeliveryDelayRow[];
  penaltyExposureByContract: PenaltyExposureRow[];
  opsEventsFeed: OpsEventRow[];
  vendorScorecards: VendorScorecardRow[];
}

// ─── Finance & Treasury dashboard ───────────────────────────────────────────

export interface FinanceTreasuryKpi {
  totalExposureAed: string;
  fxExposureNonAedAed: string;
  priceReviewTriggeredCount: number;
  paymentDelaysCount: number;
  paymentDelaysAed: string;
}

export interface FxVolatilityTile {
  aedPegStatus: 'stable' | 'deviation';
  pegDeviationBps: number | null;
  lastCheckedAt: string;
  nonAedContractCount: number;
  nonAedContractValueAed: string;
}

export interface PriceReviewRow {
  correlationId: string;
  contractId: string;
  contractNumber: string;
  counterpartyName: string;
  triggerSignalRef: string | null;
  triggerHeadline: string;
  indexName: string | null;
  indexMoveBps: number | null;
  marAed: string;
  recommendedAction: string | null;
  occurredAt: string;
}

export interface PaymentDelayRow {
  correlationId: string;
  contractId: string;
  contractNumber: string;
  counterpartyName: string;
  signalId: string;
  invoiceRef: string | null;
  daysOverdue: number | null;
  amountAed: string;
  severity: string;
}

export interface CurrencyExposureRow {
  currency: string;
  contractCount: number;
  aggregateValueOriginal: string;
  aggregateValueAed: string;
  percentOfTotal: number;
}

export interface FinanceTreasuryDashboardResponse {
  windowDays: number;
  asOf: string;
  kpi: FinanceTreasuryKpi;
  kpiPrev?: FinanceTreasuryKpi;
  fxVolatilityTile: FxVolatilityTile;
  priceReviewTriggerQueue: PriceReviewRow[];
  paymentDelayRegister: PaymentDelayRow[];
  currencyExposureBreakdown: CurrencyExposureRow[];
}

// ─── Compliance & ESG dashboard ──────────────────────────────────────────────

export interface ComplianceEsgKpi {
  sanctionsExposureDirectCount: number;
  sanctionsExposureChainCount: number;
  auditRightsExpiringCount: number;
  openRegulatoryUpdatesCount: number;
  openEsgCorrelationsCount: number;
}

export interface SanctionsExposureRow {
  contractId: string;
  contractNumber: string;
  counterpartyId: string;
  counterpartyName: string;
  sanctionsStatus: string;
  exposureKind: 'direct' | 'chain';
  chainPath: string[] | null;
  chainTruncated: boolean;
  marAed: string;
}

export interface AuditRightsRow {
  contractId: string;
  contractNumber: string;
  counterpartyName: string;
  auditClauseType: string;
  expiresOnIso: string;
  daysToExpiry: number;
  severity: 'high' | 'medium' | 'low';
}

export interface SubContractorChainRow {
  chainRootCounterpartyId: string;
  chainRootName: string;
  depthReached: number;
  sanctionedNodesCount: number;
  affectedContractsCount: number;
  chainTruncated: boolean;
}

export interface RegulatoryUpdateRow {
  regulatoryUpdateId: string;
  regulatorName: string;
  headline: string;
  severity: string;
  occurredAt: string;
  affectedContractsCount: number;
}

export interface EsgCorrelationRow {
  correlationId: string;
  headline: string;
  contractId: string;
  counterpartyName: string;
  marAed: string;
  occurredAt: string;
  severity: string;
}

export interface ComplianceEsgDashboardResponse {
  windowDays: number;
  asOf: string;
  kpi: ComplianceEsgKpi;
  kpiPrev?: ComplianceEsgKpi;
  sanctionsExposureList: SanctionsExposureRow[];
  auditRightsTracker: AuditRightsRow[];
  subContractorChainView: SubContractorChainRow[];
  regulatoryUpdatesMonitor: RegulatoryUpdateRow[];
  esgCorrelations: EsgCorrelationRow[];
}

// ─── Procurement supplier-risk dashboard ─────────────────────────────────────

export interface ProcurementKpi {
  totalSupplierCount: number;
  supplierBreachesCount: number;
  icvNonCompliantCount: number;
  supplierFinancialDistressCount: number;
  avgSupplierRiskScore: number | null;
}

export interface SupplierScorecardRow {
  counterpartyId: string;
  counterpartyName: string;
  partyType: string;
  compositeRiskScore: number | null;
  dimLegal: number | null;
  dimFinancial: number | null;
  dimOperational: number | null;
  dimReputational: number | null;
  dimCompliance: number | null;
  slaBreachCount180d: number;
  activeContractCount: number;
  totalContractValueAed: string;
  riskTier: 'high' | 'medium' | 'low';
}

export interface IcvComplianceRow {
  counterpartyId: string;
  counterpartyName: string;
  icvStatus: string | null;
  icvPct: number | null;
  icvLastChecked: string | null;
  activeContractCount: number;
  contractValueAed: string;
}

export interface BackupSupplierAlternative {
  counterpartyId: string;
  counterpartyName: string;
  riskScore: number | null;
  cleanStatus: string;
}

export interface BackupSupplierGroup {
  primaryCounterpartyId: string;
  primaryName: string;
  primaryRiskScore: number | null;
  category: string;
  suggestedAlternatives: BackupSupplierAlternative[];
}

export interface VendorFinancialHealthRow {
  counterpartyId: string;
  counterpartyName: string;
  signalKind: string;
  signalHeadline: string;
  occurredAt: string;
  severity: string;
  sourceRef: string | null;
}

export interface ProcurementSupplierRiskDashboardResponse {
  windowDays: number;
  asOf: string;
  kpi: ProcurementKpi;
  kpiPrev?: ProcurementKpi;
  supplierRiskScorecard: SupplierScorecardRow[];
  icvComplianceTracker: IcvComplianceRow[];
  backupSupplierSuggestions: BackupSupplierGroup[];
  vendorFinancialHealthSummary: VendorFinancialHealthRow[];
}

// ─── Shared query param ───────────────────────────────────────────────────────

export interface DashboardWindowQueryCrg {
  windowDays?: number;
}

// ─── Permission constants ─────────────────────────────────────────────────────

export const CR_G_PERMISSION_CODES = [
  'insights.operations',
  'insights.finance_treasury',
  'insights.compliance_esg',
  'insights.procurement_supplier_risk',
  'ai.invoke.risk_assistant',
] as const;

export type CrgPermissionCode = typeof CR_G_PERMISSION_CODES[number];
