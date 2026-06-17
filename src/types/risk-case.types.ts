/**
 * Unit 7 (M19 — CR-K Risk Cases) — TypeScript Type Definitions.
 *
 * Derived from `.claude/workspace/current-module/types.ts` (Agent 5 output,
 * 2026-05-15). Imports from the FE-local @/types/api.types barrel.
 *
 * Do not edit manually — keep in sync with workspace types if DB design changes.
 */

import type { PaginationMeta } from '@/types/api.types';

// ============================================================
// SECTION A — Shared / lookup unions
// ============================================================

export type RiskCaseType =
  | 'correlation_alert'
  | 'obligation_due'
  | 'sla_breach'
  | 'system'
  | 'manual';

export type RiskCasePriority = 'low' | 'medium' | 'high' | 'critical';

export type RiskCaseStatus =
  | 'open'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'accept_risk'
  | 'snoozed'
  | 'closed';

/**
 * Strict-matrix transitions accepted by fn_risk_case_status_transition.
 * Escalate/AcceptRisk/Snooze/Close use dedicated endpoints.
 */
export type RiskCaseTransitionStatus = 'in_review' | 'approved' | 'rejected';

export type RiskCaseClosureOutcome =
  | 'mitigated'
  | 'accepted'
  | 'no_action'
  | 'advisory_dispatched';

export type RiskCaseEventType =
  | 'created'
  | 'assigned'
  | 'status_changed'
  | 'comment_added'
  | 'evidence_uploaded'
  | 'escalated'
  | 'accepted_risk'
  | 'snoozed'
  | 'closed'
  | 'reopened';

/**
 * Renamed from `DataClassification` to avoid collision with M7's project-wide
 * `DataClassification` ('demo'|'pilot'|'production').
 */
export type ContentSensitivity = 'public' | 'internal' | 'restricted' | 'sensitive';

// ============================================================
// SECTION B — Risk Case rows
// ============================================================

export interface CorrelationSummary {
  id: number;
  ruleId: string;
  confidence: number;
}

export interface RiskCaseListItem {
  id: number;
  priority: RiskCasePriority;
  status: RiskCaseStatus;
  title: string;
  caseType: RiskCaseType;
  /**
   * Rule-based risk taxonomy slug (fn_classify_risk, migration 544).
   * Authoritative classification surfaced in the UI as a colored pill —
   * see components/risk/RiskTypePill for the canonical slug list and
   * fallback behavior. `caseType` stays as provenance ("how the case
   * was opened") but is no longer rendered in the list.
   */
  riskType: string;
  /** 690 — internal vs external (derived from the triggering signal). */
  riskOrigin?: RiskOrigin;
  assignedRole: string | null;
  assignedUserId: number | null;
  assignedUserName: string | null;
  dueAt: string | null;
  slaCountdownSeconds: number | null;
  // Phase A — dedicated Contract + Counterparty columns. fn_risk_case_list
  // (migration 548) splits the contract metadata across these fields so
  // the FE can render Contract # / Title / Counterparty independently
  // without a per-row sub-query.
  contractId: number | null;
  contractNumber: string | null;
  contractTitle: string | null;
  counterpartyName: string | null;
  correlationSummary: CorrelationSummary | null;
}

/**
 * Phase A — payload returned by GET /risk-cases/assignable-users.
 * Powers the inline reassignment dropdown + the new "Assigned to"
 * filter on the Risk Cases list.
 */
export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  roleName: string;
  roleDisplay: string;
}

export interface RiskCaseListResponse {
  data: RiskCaseListItem[];
  pagination: PaginationMeta;
}

export interface RiskCaseListQuery {
  status?: RiskCaseStatus | 'open_all';
  priority?: RiskCasePriority;
  assignedToMe?: boolean;
  slaDueWithinHours?: number;
  caseType?: RiskCaseType;
  search?: string;
  page?: number;
  limit?: number;
  // Phase A — server-side "Assigned to" filter.
  assignedUserId?: number;
}

/**
 * 690 — risk origin. 'internal' when the triggering signal came from one of our
 * own systems (SAP/ServiceNow/Primavera/…); 'external' for OSINT-sourced signals
 * (sanctions/weather/commodity/…). Derived server-side from correlation→signal.kind.
 */
export type RiskOrigin = 'internal' | 'external';

export interface RiskCase {
  id: number;
  tenantId: string;
  correlationId: number | null;
  contractId: number | null;
  caseType: RiskCaseType;
  /** See RiskCaseListItem.riskType. */
  riskType: string;
  /** 690 — internal vs external (derived from the triggering signal). */
  riskOrigin?: RiskOrigin;
  priority: RiskCasePriority;
  title: string;
  body: string | null;
  assignedRole: string | null;
  // K34 fix — humanised role label returned by BE mig 372.
  assignedRoleDisplay?: string | null;
  assignedUserId: number | null;
  // K35 fix — assignee's display name returned by BE mig 372.
  assignedUserName?: string | null;
  status: RiskCaseStatus;
  slaHours: number | null;
  dueAt: string | null;
  snoozedUntil: string | null;
  closedAt: string | null;
  closedBy: number | null;
  closureOutcome: RiskCaseClosureOutcome | null;
  dedupeKey: string | null;
  metadata: Record<string, unknown>;
  dataClassification: ContentSensitivity;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
  isActive: boolean;
}

export interface LinkedContractSummary {
  id: number;
  title: string;
  // K36 fix — BE mig 372 also returns titleEn / titleAr / contractNumber;
  // declare them so the FE can fall back to contractNumber when title is empty.
  titleEn?: string | null;
  titleAr?: string | null;
  contractNumber?: string | null;
  status: string;
  ourPartyId?: number | null;
  counterpartyId?: number | null;
}

export interface LinkedAdvisoryDraftSummary {
  id: number;
  templateId: string;
  approvalStatus: string;
  createdAt: string;
}

export interface RiskCaseEvent {
  id: number;
  tenantId: string;
  riskCaseId: number;
  eventType: RiskCaseEventType;
  actorId: number | null;
  actorName: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface RiskCaseAttachment {
  id: number;
  tenantId: string;
  riskCaseId: number;
  fileName: string;
  fileMime: string;
  fileBytes: number;
  fileUri: string;
  uploadedBy: number;
  uploadedByName: string | null;
  uploadedAt: string;
  isActive: boolean;
}

/**
 * Composite payload returned by fn_risk_case_get_by_id and every lifecycle
 * write fn (create / assign / status_transition / accept_risk / snooze / close).
 */
/**
 * mig 656 — counterparty block resolved server-side from
 * contract.counterparty_id → party. NULL when the case has no linked
 * contract.
 */
export interface CounterpartySummary {
  id: number;
  nameEn: string | null;
  nameAr: string | null;
  partyType: string | null;
  country: string | null;
  emirate: string | null;
  isVerified: boolean | null;
  sanctionsStatus: string | null;
  sanctionsLastChecked: string | null;
  sanctionsMatchSignalId: number | null;
  icvStatus: string | null;
  icvPct: number | null;
  esgScore: number | null;
  parentId: number | null;
  parentName: string | null;
  aliases: string[] | null;
}

/**
 * 690 — one fetched field from the source system record (label + value),
 * e.g. { label: 'Approved budget', value: 'AED 4,220,000,000' }.
 */
export interface SourceRecordField {
  label: string;
  value: string;
}

/**
 * 690 — the actual record fetched from an internal source system that triggered
 * an internal risk case. Rendered inline on the case detail so a reviewer sees
 * the real system data (system + record + values), not just an outbound link.
 * NULL for external cases.
 */
export interface SourceSystemRecord {
  systemCode: string | null;
  systemName: string | null;
  systemKind: string | null;
  recordRef: string | null;
  recordUrl: string | null;
  capturedAt: string | null;
  signalSubtype: string | null;
  snapshot: {
    systemName?: string;
    systemCode?: string;
    systemKind?: string;
    recordType?: string;
    recordId?: string;
    recordUrl?: string;
    capturedAt?: string;
    fields?: SourceRecordField[];
  } | null;
}

export interface RiskCaseDetail {
  riskCase: RiskCase;
  timeline: RiskCaseEvent[];
  attachments: RiskCaseAttachment[];
  linkedCorrelation: CorrelationSummary | null;
  linkedContract: LinkedContractSummary | null;
  linkedAdvisoryDrafts: LinkedAdvisoryDraftSummary[];
  /** mig 656 — counterparty resolved via contract.counterparty_id → party. */
  counterparty: CounterpartySummary | null;
  /** 690 — actual internal source-system record for internal cases; null otherwise. */
  sourceSystemRecord: SourceSystemRecord | null;
  slaCountdownSeconds: number | null;
}

// --- Risk Case DTOs ------------------------------------------

export interface CreateRiskCaseDto {
  contractId?: number | null;
  priority: RiskCasePriority;
  title: string;
  body?: string | null;
  assignedRole?: string | null;
  assignedUserId?: number | null;
  slaHours?: number | null;
  metadata?: Record<string, unknown>;
}

export interface AssignRiskCaseDto {
  assignedRole?: string | null;
  assignedUserId?: number | null;
}

export interface AddRiskCaseCommentDto {
  comment: string;
}

export interface AddRiskCaseCommentResponse {
  eventId: number;
}

export interface AddRiskCaseEvidenceDto {
  fileUri: string;
  fileName: string;
  fileMime: string;
  fileBytes: number;
}

export interface AddRiskCaseEvidenceResponse {
  attachment: RiskCaseAttachment;
  eventId: number;
}

export interface StatusTransitionRiskCaseDto {
  toStatus: RiskCaseTransitionStatus;
  decisionNote?: string | null;
}

export interface EscalateRiskCaseDto {
  reason?: string | null;
}

export interface EscalateRiskCaseResponse {
  riskCase: RiskCaseDetail;
  newAssignedRole: string;
  matrixHopCount: number;
}

export interface AcceptRiskCaseDto {
  approverUserId: number;
  justification: string;
}

export interface SnoozeRiskCaseDto {
  snoozedUntil: string;
}

export interface CloseRiskCaseDto {
  outcome: RiskCaseClosureOutcome;
  closureNote?: string | null;
}

/**
 * Evidence detail response — extends attachment metadata with the minted
 * signed-URL pair returned by the BE controller. signed URL TTL is 60s.
 */
export interface RiskCaseEvidenceDetail extends RiskCaseAttachment {
  signedUrl: string;
  signedUrlExpiresAt: string;
}

// --- Tuple labels for status badges ---
export const RISK_CASE_STATUSES: RiskCaseStatus[] = [
  'open',
  'in_review',
  'approved',
  'rejected',
  'escalated',
  'accept_risk',
  'snoozed',
  'closed',
];

export const RISK_CASE_PRIORITIES: RiskCasePriority[] = ['low', 'medium', 'high', 'critical'];

export const RISK_CASE_CASE_TYPES: RiskCaseType[] = [
  'correlation_alert',
  'obligation_due',
  'sla_breach',
  'system',
  'manual',
];

export const RISK_CASE_CLOSURE_OUTCOMES: RiskCaseClosureOutcome[] = [
  'mitigated',
  'accepted',
  'no_action',
  'advisory_dispatched',
];

/**
 * Valid state-machine transitions consumed by RiskCaseStatusTransitionDialog.
 * Mirrors the strict matrix enforced at fn level (HITL Q3=strict).
 */
export const STRICT_TRANSITIONS: Record<RiskCaseStatus, RiskCaseTransitionStatus[]> = {
  open: ['in_review'],
  in_review: ['approved', 'rejected'],
  approved: [],
  rejected: [],
  escalated: [],
  accept_risk: [],
  snoozed: [],
  closed: [],
};

/**
 * Statuses that allow Close transition. open is rejected by fn (P0001).
 */
export const CLOSABLE_STATUSES: RiskCaseStatus[] = [
  'approved',
  'rejected',
  'accept_risk',
  'escalated',
  'in_review',
];

/**
 * Statuses that allow Escalate transition.
 */
export const ESCALATABLE_STATUSES: RiskCaseStatus[] = [
  'open',
  'in_review',
  'escalated',
  'snoozed',
];

export const TERMINAL_STATUSES: RiskCaseStatus[] = [
  'approved',
  'rejected',
  'accept_risk',
  'closed',
];
