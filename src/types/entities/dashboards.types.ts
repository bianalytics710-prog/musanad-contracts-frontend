/**
 * Musanad — M6 Dashboards & Reporting — TypeScript types.
 *
 * Mirrors the BE `src/types/dashboards.types.ts` shapes verbatim. All keys
 * match the fn_ JSONB output (camelCase) per Patch Round 1 corrections:
 *   - signedByMeWindow uses signature_event.actor_user_id / created_at /
 *     event_type='signed' (S2-22-FIX-1)
 *   - pendingMyApprovalCount uses COALESCE(delegated_to, reassigned_to,
 *     approver_user_id) (S2-22-FIX-2a)
 *   - auditSummary keys are live audit_log.table_name (S2-22-FIX-4)
 *   - approvalDecisionsByDay uses present-tense approve/reject literals
 *     (S2-22-WARN-1-FIX)
 *
 * SECURITY: M6 returns aggregates only. List slots project a 7-column
 * lighter shape (DashboardContractRow) — never contract_body or any other
 * sensitive field.
 *
 * No edits — regenerate via the FE Implementation Agent if api-contracts
 * change.
 */

// ─── Time-window query param (operational dashboards) ───────────────────────

/** Optional time-window query for dashboard endpoints. Range varies. */
export interface DashboardWindowQuery {
  /** Rolling window in days. Range varies per endpoint (1..365 or 1..90). */
  windowDays?: number;
}

/** ?range=last_7d|last_30d|last_90d|custom — UI-side selector helper. */
export type DashboardRangeKey = "last_7d" | "last_30d" | "last_90d" | "custom";

export const DASHBOARD_RANGE_DEFAULTS: Record<DashboardRangeKey, number | null> = {
  last_7d: 7,
  last_30d: 30,
  last_90d: 90,
  custom: null,
};

// ─── Domain enums (open-string for forward-compat where applicable) ─────────

export type DashboardKey =
  | "admin"
  | "drafter"
  | "approver"
  | "legal_counsel"
  | "recipient"
  | "executive"
  // Post-v1.5 hardening (migration 346): the 4 CR-G ADNOC personas.
  | "operations"
  | "finance_treasury"
  | "compliance_esg"
  | "procurement";

export type HealthStatusOverall = "ok" | "degraded" | "unhealthy";
export type HealthDbStatus = "ok" | "degraded";

/** Open string union — sourced from M4 ai_insight payload. */
export type AnomalySeverity = string;

// ─── Embedded shape — placeholder slot ──────────────────────────────────────

/**
 * Placeholder envelope returned by:
 *   - LegalCounselDashboardKpis.templateUsageThisWindow
 *   - RecipientDashboardKpis.myObligationsCount
 * The FE renders disabled tile + "feature pending" tooltip per DASH-OI-A.
 */
export interface PlaceholderKpi {
  /** Always 0. */
  value: 0;
  /** Always true — distinguishes from a real zero count. */
  placeholder: true;
}

// ─── Shared embedded list-row shapes ────────────────────────────────────────

/**
 * Lightweight contract row for dashboard list slots. Source columns:
 * id, contract_number, title_en, title_ar, status, value_aed, updated_at.
 * NEVER includes contract_body.
 */
export interface DashboardContractRow {
  id: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  /** contractType is populated by fn_dashboard_drafter.myDrafts5 (v607+).
   *  Optional because older fn outputs (other dashboards / pre-607) omit it. */
  contractType?: string | null;
  status: string;
  valueAed: number | null;
  updatedAt: string;
}

/** Drafter awaiting-action row — adds lastDecisionNote. */
export interface DrafterAwaitingActionRow {
  id: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  status: string;
  lastDecisionNote: string | null;
}

/** Approver pending-queue row — joined approval_step + contract. */
export interface ApproverPendingQueueRow {
  stepId: number;
  contractId: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  valueAed: number | null;
  /** approval_step.created_at AS requestedAt (S2-22-FIX-2b). */
  requestedAt: string;
  /** EXTRACT(EPOCH FROM (NOW() - step.created_at))/3600 — decimal hours. */
  hoursWaiting: number;
}

/** Recipient my-contracts row — joined contract + signature_party.
 * R4/R17 (Rashid audit 2026-06-01): now ships counterpartyId + party names
 * so the FE list + detail Parties section can populate real values rather
 * than rendering "Counterparty details: pending" / "—" placeholders. */
export interface RecipientMyContractsRow {
  id: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  status: string;
  ourPartyId: number;
  ourPartyNameEn: string | null;
  ourPartyNameAr: string | null;
  counterpartyId: number | null;
  counterpartyNameEn: string | null;
  counterpartyNameAr: string | null;
  updatedAt?: string | null;
}

/** Recipient pending-signature row — joined signature_invitation + party + contract.
 * R4 (Rashid audit 2026-06-01): adds counterpartyNameEn so the hero card can
 * render the counterparty alongside the contract number. */
export interface RecipientPendingSignatureRow {
  invitationId: number;
  contractId: number;
  contractNumber: string;
  counterpartyNameEn?: string | null;
  /** signature_invitation.invitation_sent_at AS sentAt (S2-22-FIX-5a). */
  sentAt: string;
  /** signature_invitation.invitation_expires_at AS expiresAt. */
  expiresAt: string | null;
}

/** Recent regulatory update row — lighter than M5 RegulatoryUpdate. */
export interface DashboardRegulatoryUpdateRow {
  id: number;
  titleEn: string;
  severity: string;
  effectiveDate: string | null;
  regulator: { id: number; nameEn: string };
}

/** Open regulatory-impact row — lighter than M5 RegulatoryImpact. */
export interface DashboardOpenImpactRow {
  id: number;
  contractId: number;
  contractNumber: string;
  regulationTitleEn: string;
  /** COALESCE(ru.severity, 'unknown'). */
  severity: string;
  detectedAt: string;
}

/** Trend point — { date: 'YYYY-MM-DD', count: integer }. */
export interface TrendDayCount {
  date: string;
  count: number;
}

/** Approval-decision day point — separates approved vs rejected counts. */
export interface ApprovalDecisionDayPoint {
  date: string;
  approved: number;
  rejected: number;
}

/** Monthly trend point. */
export interface TrendMonthCount {
  /** YYYY-MM. */
  month: string;
  count: number;
}

/** Monthly value point — fn_dashboard_executive trends.valueOverTimeByMonth. */
export interface TrendMonthValueAed {
  month: string;
  totalValueAed: number;
}

/** Counterparty concentration — names embedded by BE as of CR-FIX1. */
export interface CounterpartyConcentrationRow {
  counterpartyId: number;
  totalValueAed: number;
  contractCount: number;
  counterpartyName?: string;
  counterpartyNameAr?: string | null;
  counterpartyEmirate?: string | null;
}

/** Value-distribution histogram bucket. */
export interface ValueDistributionBucket {
  /** '<100k' | '100k-1M' | '1M-10M' | '10M+'. */
  bucket: string;
  count: number;
}

/** Top-prompt cost row — fn_dashboard_ai_cost_summary topPromptsByCost5. */
export interface AiCostTopPromptRow {
  promptId: number;
  requestCount: number;
  /** USD with 2dp at FE (AC-S11-07). */
  totalCostUsd: number;
  /** null when prompt has zero successful requests (S2-18 NULL semantic). */
  cacheHitRatio: number | null;
}

// ─── Admin dashboard (S1, S13) ──────────────────────────────────────────────

export interface AdminDashboardKpis {
  totalContractsActive: number;
  /** Keys are contract.status literals (open string union). */
  totalContractsByStatus: Record<string, number>;
  expiringWithin30d: number;
  /** AC-S1-04 monotonic — expiringWithin30d <= expiringWithin90d. */
  expiringWithin90d: number;
  pendingApprovals: number;
  pendingSignatures: number;
  /** WHERE resolved = FALSE AND is_active = TRUE (CRIT-1). */
  openRegulatoryImpacts: number;
  recentAuditEvents: number;
  totalActiveUsers: number;
}

export interface AdminDashboardTrends {
  contractsCreatedByDay: TrendDayCount[];
  approvalDecisionsByDay: ApprovalDecisionDayPoint[];
}

export interface AdminDashboardKpiPrev {
  totalContractsActive: number;
  expiringWithin30d: number;
  expiringWithin90d: number;
  pendingApprovals: number;
  pendingSignatures: number;
  openRegulatoryImpacts: number;
  recentAuditEvents: number;
  totalActiveUsers: number;
}

export interface AdminSystemHealth {
  dbStatus: "ok" | "degraded" | "down";
  latestMigration: number;
  auditEvents24h: number;
  aiErrors24h: number;
}

export interface AdminPendingActions {
  pendingApprovals: number;
  pendingSignatures: number;
  pendingImports: number;
  openImpacts: number;
}

export interface AdminTopContractTypeRow {
  contractType: string;
  count: number;
}

export interface AdminSystemActivityRow {
  eventType: string;
  headline: string;
  occurredAt: string;
  entityType: string;
  entityId: number | null;
}

export interface AdminDashboardSnapshot {
  kpis: AdminDashboardKpis;
  /** R-PA1 — present when fn_dashboard_admin >= migration 095. */
  kpiPrev?: AdminDashboardKpiPrev;
  trends: AdminDashboardTrends;
  /** R-PA1 — present when fn_dashboard_admin >= migration 095. */
  systemHealth?: AdminSystemHealth;
  /** R-PA1 — present when fn_dashboard_admin >= migration 095. */
  pendingAdminActions?: AdminPendingActions;
  /** R-PA1 — present when fn_dashboard_admin >= migration 095. */
  topContractTypes5?: AdminTopContractTypeRow[];
  /** R-PA1 — present when fn_dashboard_admin >= migration 095. */
  systemActivity14d?: AdminSystemActivityRow[];
}

// ─── Drafter dashboard (S2) ─────────────────────────────────────────────────

export interface DrafterDashboardKpis {
  myDraftsCount: number;
  /**
   * 2026-06-09 — broader pipeline counter than myDraftsCount: counts
   * everything Hala originated that is still in flight (draft +
   * in_approval + resubmission_requested + awaiting_signature_*).
   * Optional for backward compatibility with older BE deploys.
   */
  inProgressCount?: number;
  awaitingMyActionCount: number;
  readyToSendCount: number;
  myRecentlyApprovedCount: number;
  /** All-time count of my contracts in fully_signed / active / expired /
   *  terminated / amended. Donut input; reconciles donut total with the
   *  Contracts list total. Optional for older BE deploys (v607+). */
  mySignedAllTimeCount?: number;
}

export interface DrafterDashboardLists {
  myDrafts5: DashboardContractRow[];
  awaitingMyAction5: DrafterAwaitingActionRow[];
}

export interface DrafterDashboardSnapshot {
  kpis: DrafterDashboardKpis;
  lists: DrafterDashboardLists;
}

// ─── Approver dashboard (S3) ────────────────────────────────────────────────

export interface ApproverDashboardKpis {
  pendingMyApprovalCount: number;
  decidedByMeCount: number;
  /** NULL when 0 decisions in window. */
  averageDecisionHoursMine: number | null;
  averageDecisionHoursTeam: number | null;
  // R5 additions — queue segments and SLA breach
  queueTeamCount?: number;
  queueQuickApproveCount?: number;
  slaBreachCount?: number;
  // R5 — prior-period values for delta arrows
  kpiPrev?: {
    decidedByMeCount: number;
    averageDecisionHoursMine: number | null;
    pendingMyApprovalCount: number;
  };
}

/**
 * Mig 532 — approver dashboard shape revamp. Replaces the legacy
 * `lists` + `charts` containers with a flat queue-management view + an
 * insights block tuned to "what's on my plate today".
 */
export type RiskBand = "Low" | "Medium" | "High";

export interface ApproverPendingQueueRowV2 {
  stepId: number;
  contractId: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  valueAed: number | null;
  counterpartyName: string | null;
  riskScore: number | null;
  riskBand: RiskBand | null;
  hoursWaiting: number;
  slaAtRisk: boolean;
  submittedByName: string | null;
  requestedAt: string;
}

export interface ApproverNextUp {
  stepId: number;
  contractId: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  valueAed: number | null;
  counterpartyName: string | null;
  riskScore: number | null;
  riskBand: RiskBand | null;
  hoursWaiting: number;
  submittedByName: string | null;
}

export interface ApproverDashboardKpisV2 {
  awaitingMyDecision: { current: number; previous: number };
  slaAtRisk: number;
  highValueInQueue: { count: number; totalAed: number | string | null };
  medianDecisionHours: {
    thisMonth: number | null;
    lastMonth: number | null;
    /** Mig 534+ — "rolling_30d" or "all_time". Tells FE which label to show. */
    source?: "rolling_30d" | "all_time";
  };
}

export interface ApproverVelocityPoint {
  day: string;
  decisionCount: number;
  medianHours: number | null;
}

export interface ApproverQueueRiskProfile {
  low: number;
  medium: number;
  high: number;
  unrated: number;
  total: number;
}

export interface ApproverCounterpartyConcentration {
  counterpartyId: number;
  name: string | null;
  contractsCount: number;
  totalAed: number | string | null;
}

export interface ApproverRecentDecisionRowV2 {
  contractId: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  counterpartyName: string | null;
  decision: "approve" | "reject" | "request_info" | "request_resubmission";
  decisionNote: string | null;
  decidedAt: string;
  valueAed: number | null;
}

export interface ApproverDecisionMix90d {
  approved: number;
  rejected: number;
  requestedInfo: number;
  total: number;
}

export interface ApproverDashboardInsights {
  /** Canonical velocity series — mig 534+ uses {@link decisionVelocityWindowDays}. */
  decisionVelocity?: ApproverVelocityPoint[];
  /** Mig 534+ — actual window the velocity covers (30, 90, 180, or up to 365 for all-time). */
  decisionVelocityWindowDays?: number;
  /** Legacy field maintained for back-compat. */
  decisionVelocity30d: ApproverVelocityPoint[];
  queueRiskProfile: ApproverQueueRiskProfile;
  counterpartyConcentration: ApproverCounterpartyConcentration[];
  recentDecisions: ApproverRecentDecisionRowV2[];
  decisionMix90d: ApproverDecisionMix90d;
}

export interface ApproverDashboardSnapshot {
  kpis: ApproverDashboardKpisV2;
  nextUp: ApproverNextUp | null;
  pendingQueue: ApproverPendingQueueRowV2[];
  insights: ApproverDashboardInsights;
}

// ─── Legal-counsel dashboard (S4) ───────────────────────────────────────────

export interface LegalCounselDashboardKpis {
  regulatoryUpdatesThisWindow: number;
  openRegulatoryImpacts: number;
  criticalSeverityCount: number;
  regulationCatalogSize: number;
  /**
   * Keys are LIVE audit_log.table_name (S2-22-FIX-4).
   * NULL when caller lacks 'audit.read' (CRIT-4 lock).
   */
  auditSummary: Record<string, number> | null;
  /** R-LC1 — contracts-led KPIs added for Lovable parity. */
  activeContracts: number;
  expiringIn30d: number;
  pendingReview: number;
}

export interface LegalCounselDashboardLists {
  recentRegulatoryUpdates5: DashboardRegulatoryUpdateRow[];
  openImpacts5: DashboardOpenImpactRow[];
}

export interface LegalCounselApprovalQueueRow {
  id: number;
  contractId: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  contractType: string;
  valueAed: number | null;
  currency: string;
  submittedAt: string | null;
  drafterFirstName: string | null;
  drafterLastName: string | null;
  stepOrder: number;
  totalSteps: number;
}

export interface LegalCounselTopRiskRow {
  id: number;
  contractNumber: string;
  titleEn: string;
  risk: number;
}

export interface LegalCounselRiskExposure {
  lowCount: number;
  mediumCount: number;
  highCount: number;
  totalActive: number;
  top5HighRisk: LegalCounselTopRiskRow[];
}

export interface LegalCounselWeekHours {
  weekIndex: number;
  avgHours: number;
}

export interface LegalCounselWeeklyAuthority {
  weekIndex: number;
  authority: string | null;
  count: number;
}

export interface LegalCounselRegulatoryUpdates12w {
  totalUpdates: number;
  authoritiesActive: number;
  weeklyByAuthority: LegalCounselWeeklyAuthority[];
}

export interface LegalCounselContractTypeRow {
  type: string;
  count: number;
  pct: number;
}

export interface LegalCounselContractTypes {
  total: number;
  rows: LegalCounselContractTypeRow[];
}

export interface LegalCounselObligationRow {
  id: number;
  titleEn: string;
  contractId: number;
  contractNumber: string;
  dueDate: string | null;
  status: string;
  daysOverdue: number;
  daysLeft: number;
}

export interface LegalCounselObligations {
  overdueCount: number;
  dueThisWeekCount: number;
  top5: LegalCounselObligationRow[];
}

export interface LegalCounselActivityRow {
  id: number;
  activityType: string;
  contractId: number;
  contractNumber: string;
  description: string;
  createdAt: string;
  actorUserId: number | null;
}

export interface LegalCounselDashboardSnapshot {
  kpis: LegalCounselDashboardKpis;
  lists: LegalCounselDashboardLists;
  approvalQueue5: LegalCounselApprovalQueueRow[];
  risk: LegalCounselRiskExposure;
  avgReview12w: LegalCounselWeekHours[];
  regulatoryUpdates12w: LegalCounselRegulatoryUpdates12w;
  contractTypes: LegalCounselContractTypes;
  obligations: LegalCounselObligations;
  activityFeed: LegalCounselActivityRow[];
}

// ─── Legal-counsel insights (mig 685) ──────────────────────────────────────

export interface LegalCounselInsightsKpis {
  contractsPendingMyReview: number;
  advisoriesInProgress: number;
  tpaReviewsAwaitingMe: number;
  myOpenRiskCases: number;
}

export interface LegalCounselAdvisoryPipeline {
  draft: number;
  inExecReview: number;
  approvedReady: number;
  sentThisMonth: number;
}

// mig 686 — named lifecycle buckets for the third-party-review funnel.
export interface LegalCounselTpaPipeline {
  received: number;
  awaitingOurReview: number;
  reviewed: number;
  awaitingCounterparty: number;
  accepted: number;
  rejected: number;
}

export interface LegalCounselTemplateClause {
  templateCount: number;
  clauseCount: number;
  approvedClauseCount: number;
}

export interface LegalCounselRiskCaseRow {
  id: number;
  title: string;
  caseType: string;
  status: string;
  priority: string;
}

// mig 686 — avg legal review time, in DAYS, glitch-filtered.
export interface LegalCounselAvgReview {
  avgDays: number;
  sampleSize: number;
  series12w: Array<{ weekIndex: number; avgDays: number }>;
}

export interface LegalCounselInsights {
  kpis: LegalCounselInsightsKpis;
  advisoryPipeline: LegalCounselAdvisoryPipeline;
  tpaPipeline: LegalCounselTpaPipeline;
  templateClause: LegalCounselTemplateClause;
  myRiskCases: LegalCounselRiskCaseRow[];
  avgReview: LegalCounselAvgReview;
}

// ─── Recipient dashboard (S5) ───────────────────────────────────────────────

export interface RecipientDashboardKpis {
  myContractsCount: number;
  pendingMySignatureCount: number;
  /**
   * R3 (Rashid audit 2026-06-01) — renamed from `signedByMeWindow`. Counts
   * any contract the recipient is a signer-of AND that's either fully_signed
   * OR has a signature_event signed by them. Lifetime-scoped, not windowed,
   * to reconcile with the visible "My contracts" list.
   */
  signedByMeCount: number;
  /** Optional during transition — newer BE (mig 435+) drops the placeholder. */
  myObligationsCount?: PlaceholderKpi;
}

export interface RecipientDashboardLists {
  myContracts5: RecipientMyContractsRow[];
  pendingSignatures5: RecipientPendingSignatureRow[];
}

export interface RecipientDashboardSnapshot {
  kpis: RecipientDashboardKpis;
  lists: RecipientDashboardLists;
  /** R7 — signals whether ANY field on the dashboard scopes by window. When
   * false, the FE hides the orphan date-pill row. */
  windowApplies?: boolean;
}

// ─── Router (S6) ────────────────────────────────────────────────────────────

export interface DashboardPermissionsSummary {
  canViewAdminDashboard: boolean;
  canViewExecutiveDashboard: boolean;
}

export interface DashboardRouterResponse {
  userId: number;
  /**
   * Raw role.name; fn_user_get_by_id returns nested {role:{id,name}}
   * (S2-22-WARN-3-FIX). FE keeps the literal as-is.
   */
  primaryRole: string;
  dashboardKey: DashboardKey;
  permissionsSummary: DashboardPermissionsSummary;
}

// ─── Executive dashboard (S7) ───────────────────────────────────────────────

export interface ExecutiveExpiryCliffs {
  next30d: number;
  /** AC-S7-03 monotonic. */
  next60d: number;
  next90d: number;
}

export interface ExecutiveCycleTimeFunnel {
  draftingDays: number;
  legalReviewDays: number;
  approvalChainDays: number;
  counterpartySignatureDays: number;
}

export interface ExecutiveDashboardKpis {
  totalActiveValueAed: number;
  /** R-EX0 — count of contracts in active|fully_signed|expiring_soon. */
  activeContractsCount: number;
  /** R-EX0 — sum of cycleTimeFunnel stage averages, in days. */
  avgCycleTimeDays: number;
  /** R-EX0 — count of renewable contracts due in the next 90 days. */
  renewalsCount90d: number;
  /** R-EX0 — sum of value_aed for the renewable set above. */
  renewalValueAed90d: number;
  /** R-EX0 — 4-stage cycle-time breakdown for the funnel chart. */
  cycleTimeFunnel: ExecutiveCycleTimeFunnel;
  contractsByStatus: Record<string, number>;
  expiryCliffs: ExecutiveExpiryCliffs;
  topCounterpartiesByValue5: CounterpartyConcentrationRow[];
  valueDistribution: ValueDistributionBucket[];
  openRegulatoryImpactsCritical: number;
  /**
   * Inline AI cost (Q5 lock). NULL when caller lacks ai.observability.read
   * (AC-S7-05). 90-day cap inherited via LEAST clause.
   */
  aiCostUsdWindow: number | null;
}

/**
 * R-EX0 — previous-window comparison block for delta indicators.
 * Same KPI definitions as `kpis`, computed against the [v_window..2*v_window]
 * range so the FE can render +X% / +N tile deltas.
 */
export interface ExecutiveDashboardKpiPrev {
  totalActiveValueAed: number;
  activeContractsCount: number;
  renewalsCount90d: number;
  renewalValueAed90d: number;
}

export interface ExecutiveDashboardTrends {
  valueOverTimeByMonth: TrendMonthValueAed[];
  contractsCreatedByMonth: TrendMonthCount[];
}

/** R-EX1 — chart-section payloads from migration 090. */
export interface ExecutiveSpendByCategoryRow {
  category: string;
  valueAed: number;
  pct: number;
}
export interface ExecutiveSupplierSparklinePoint {
  month: string;
  valueAed: number;
}
export interface ExecutiveTopSupplierRow {
  counterpartyId: number;
  name: string;
  contractCount: number;
  totalValueAed: number;
  pctOfSpend: number;
  sparkline12m: ExecutiveSupplierSparklinePoint[];
}
export interface ExecutiveRevenueMonthRow {
  month: string;
  activeValueAed: number;
  pipelineValueAed: number;
}
export interface ExecutiveThroughputMonthRow {
  month: string;
  initiated: number;
  signed: number;
}
export interface ExecutiveExpiryCliffBucket {
  horizon: "30d" | "60d" | "90d" | "180d" | "365d" | ">365d";
  valueAedAtRisk: number;
}
export interface ExecutiveDashboardCharts {
  spendByCategory: ExecutiveSpendByCategoryRow[];
  topSuppliers: ExecutiveTopSupplierRow[];
  revenueUnderContract12m: ExecutiveRevenueMonthRow[];
  contractThroughput12m: ExecutiveThroughputMonthRow[];
  expiryCliff: ExecutiveExpiryCliffBucket[];
}

/** R-EX2 — list-section payloads from migration 091. */
export interface ExecutiveHighRiskRow {
  id: number;
  contractNumber: string;
  titleEn: string | null;
  titleAr: string | null;
  valueAed: number | null;
  riskScore: number;
}
export interface ExecutiveTemplateUsageRow {
  templateId: number;
  nameEn: string | null;
  nameAr: string | null;
  usageCount: number;
}
export interface ExecutiveAmendedContractRow {
  id: number;
  contractNumber: string;
  titleEn: string | null;
  titleAr: string | null;
  currentVersion: number;
  amendmentCount: number;
}
export interface ExecutiveDashboardLists {
  highRiskContracts8: ExecutiveHighRiskRow[];
  mostUsedTemplates8: ExecutiveTemplateUsageRow[];
  mostAmendedContracts5: ExecutiveAmendedContractRow[];
}

/** R-EX3 — events14d feed row from migration 092/093. */
export interface ExecutiveEventRow {
  eventType: string;
  headline: string;
  subRef: string | null;
  occurredAt: string;
  severity: "critical" | "high" | "low";
}

export interface ExecutiveDashboardSnapshot {
  kpis: ExecutiveDashboardKpis;
  /** Optional — present from migration 089 onwards. */
  kpiPrev?: ExecutiveDashboardKpiPrev;
  trends: ExecutiveDashboardTrends;
  /** Optional — present from migration 090 onwards. */
  charts?: ExecutiveDashboardCharts;
  /** Optional — present from migration 091 onwards. */
  lists?: ExecutiveDashboardLists;
  /** Optional — present from migration 092/093 onwards. */
  events14d?: ExecutiveEventRow[];
}

// ─── Executive anomalies history (S8) ───────────────────────────────────────

export interface ExecutiveAnomaly {
  id: number;
  summaryEn: string | null;
  summaryAr: string | null;
  severity: AnomalySeverity;
  detectedAt: string;
  /** Free-form payload from M4 ai_insight.payload — JSON. */
  payload: Record<string, unknown> | null;
}

export interface ExecutiveAnomaliesHistoryResponse {
  /** Empty array (NOT 404) when cache empty — AC-S8-02. */
  anomalies: ExecutiveAnomaly[];
}

export interface ExecutiveAnomaliesHistoryQuery {
  /** Default 10, range 1..50. */
  limit?: number;
}

// ─── AI cost summary (S11) ──────────────────────────────────────────────────

export interface AiCostSummary {
  totalCostUsdWindow: number;
  totalRequestsWindow: number;
  /** NULL when totalRequestsWindow = 0 (S2-18). */
  cacheHitRatioOverall: number | null;
  topPromptsByCost5: AiCostTopPromptRow[];
}

// ─── Health check (S12) ─────────────────────────────────────────────────────

export interface HealthCheckDb {
  status: HealthDbStatus;
  /** NULL when schema_migrations_select_admin policy missing or table empty. */
  latestMigration: number | null;
  currentTimestamp: string;
}

export interface HealthCheckAi {
  lastSuccessfulRequestAt: string | null;
  lastFailureAt: string | null;
  /**
   * lastSuccessfulRequestAt IS NOT NULL AND
   * (lastFailureAt IS NULL OR lastSuccessfulRequestAt > lastFailureAt).
   */
  estimatedHealthy: boolean;
}

export interface HealthCheckSnapshot {
  db: HealthCheckDb;
  ai: HealthCheckAi;
  overall: HealthStatusOverall;
}

// ─── Type guard helpers ─────────────────────────────────────────────────────

export function isPlaceholderKpi(value: unknown): value is PlaceholderKpi {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.value === 0 && v.placeholder === true;
}
