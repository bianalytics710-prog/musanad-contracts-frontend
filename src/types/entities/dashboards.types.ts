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
  | "executive";

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

/** Recipient my-contracts row — joined contract + signature_party. */
export interface RecipientMyContractsRow {
  id: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  status: string;
  ourPartyId: number;
  /** Always null until parties module ships. */
  counterpartyId: null;
}

/** Recipient pending-signature row — joined signature_invitation + party + contract. */
export interface RecipientPendingSignatureRow {
  invitationId: number;
  contractId: number;
  contractNumber: string;
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

/** Counterparty concentration — counterpartyId only (no parties table yet). */
export interface CounterpartyConcentrationRow {
  counterpartyId: number;
  totalValueAed: number;
  contractCount: number;
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

export interface AdminDashboardSnapshot {
  kpis: AdminDashboardKpis;
  trends: AdminDashboardTrends;
}

// ─── Drafter dashboard (S2) ─────────────────────────────────────────────────

export interface DrafterDashboardKpis {
  myDraftsCount: number;
  awaitingMyActionCount: number;
  readyToSendCount: number;
  myRecentlyApprovedCount: number;
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
}

export interface ApproverDashboardLists {
  pendingQueue5: ApproverPendingQueueRow[];
}

export interface ApproverDashboardSnapshot {
  kpis: ApproverDashboardKpis;
  lists: ApproverDashboardLists;
}

// ─── Legal-counsel dashboard (S4) ───────────────────────────────────────────

export interface LegalCounselDashboardKpis {
  regulatoryUpdatesThisWindow: number;
  openRegulatoryImpacts: number;
  criticalSeverityCount: number;
  regulationCatalogSize: number;
  /** Placeholder until templates module ships (AC-S4-05). */
  templateUsageThisWindow: PlaceholderKpi;
  /**
   * Keys are LIVE audit_log.table_name (S2-22-FIX-4).
   * NULL when caller lacks 'audit.read' (CRIT-4 lock).
   */
  auditSummary: Record<string, number> | null;
}

export interface LegalCounselDashboardLists {
  recentRegulatoryUpdates5: DashboardRegulatoryUpdateRow[];
  openImpacts5: DashboardOpenImpactRow[];
}

export interface LegalCounselDashboardSnapshot {
  kpis: LegalCounselDashboardKpis;
  lists: LegalCounselDashboardLists;
}

// ─── Recipient dashboard (S5) ───────────────────────────────────────────────

export interface RecipientDashboardKpis {
  myContractsCount: number;
  pendingMySignatureCount: number;
  /**
   * actor_user_id-keyed; external-only invitation signers are NOT counted
   * (DN-19) — internal recipients (UAE-PASS / app-authenticated) are.
   */
  signedByMeWindow: number;
  /** Placeholder until obligations module ships (AC-S5-04). */
  myObligationsCount: PlaceholderKpi;
}

export interface RecipientDashboardLists {
  myContracts5: RecipientMyContractsRow[];
  pendingSignatures5: RecipientPendingSignatureRow[];
}

export interface RecipientDashboardSnapshot {
  kpis: RecipientDashboardKpis;
  lists: RecipientDashboardLists;
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

export interface ExecutiveDashboardKpis {
  totalActiveValueAed: number;
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

export interface ExecutiveDashboardTrends {
  valueOverTimeByMonth: TrendMonthValueAed[];
  contractsCreatedByMonth: TrendMonthCount[];
}

export interface ExecutiveDashboardSnapshot {
  kpis: ExecutiveDashboardKpis;
  trends: ExecutiveDashboardTrends;
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
