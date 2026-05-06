// ============================================================
// M2 — Approval Workflows — Frontend TypeScript Type Definitions
// Project: Musanad Contracts Hub (musanad-contracts)
// Source of truth: .claude/workspace/current-module/types.ts (Agent 5)
//
// Mirrors BE src/types/approval.types.ts (camelCase wire shape).
// JSONB output keys are camelCase. Date/time fields are ISO-8601 strings.
//
// SENSITIVE — never log:
//   - decisionNote        (decision rationale; pino-redacted on BE)
//   - matrixSnapshot      (frozen matrix; pino-redacted on BE)
// ============================================================

import type { Paginated } from "@/types/api.types";
import type { UserRef } from "@/types/entities/contract.types";
// Forward-import the M2-extended ContractStatus from contract.types.ts
// (extended in same PR — adds 'in_approval' + 'cancelled').
import type { ContractStatus } from "@/types/entities/contract.types";

// ------------------------------------------------------------
// 1. Enum unions — chain / step / decision state machines
// ------------------------------------------------------------

export type ApprovalChainStatus =
  | "in_progress"
  | "approved"
  | "rejected"
  | "resubmission_requested"
  | "cancelled";

export const APPROVAL_CHAIN_STATUS_VALUES: readonly ApprovalChainStatus[] = [
  "in_progress",
  "approved",
  "rejected",
  "resubmission_requested",
  "cancelled",
];

export type ApprovalStepStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "resubmission_requested"
  | "escalated"
  | "reassigned"
  | "delegated"
  | "skipped";

export type ApprovalDecisionType =
  | "approve"
  | "reject"
  | "request_resubmission"
  | "delegate"
  | "reassign"
  | "escalate";

/** Subset of ApprovalDecisionType that the /decide endpoint accepts. */
export type DecideKind = "approve" | "reject" | "request_resubmission";

export type ApprovalPendingSort = "oldest" | "newest" | "highest_value";

export const APPROVAL_PENDING_SORT_VALUES: readonly ApprovalPendingSort[] = [
  "oldest",
  "newest",
  "highest_value",
];

// ------------------------------------------------------------
// 2. Permission codes (M2 additions, AE-4)
// ------------------------------------------------------------

export type ApprovalPermissionCode =
  | "approval.submit_for_review"
  | "approval.act"
  | "approval.delegate"
  | "approval.matrix.read"
  | "approval.matrix.write"
  | "approval.reassign";

// ------------------------------------------------------------
// 3. approval_matrix entity + DTOs (S4 / S5 / S6)
// ------------------------------------------------------------

export interface ApprovalMatrix {
  id: number;
  /** M1a contract.contract_type 8-value enum (replicated CHECK on approval_matrix). */
  contractType: string;
  /** Min AED value range (inclusive). NUMERIC(15,2) → number on the wire. */
  valueMin: number;
  /** Max AED value range (inclusive). NULL = no upper bound. */
  valueMax: number | null;
  /** Step ordinal (1..N continuous; AC-S5-02). */
  stepOrder: number;
  /** Parallel-group identifier. NULL = sequential step.
   * CHECK: parallelGroup IS NULL OR parallelGroup = stepOrder (AC-S5-05). */
  parallelGroup: number | null;
  /** Soft FK to role.name. */
  approverRole: string;
  /** Drives all-of vs any-of parallel-group rule. */
  isRequired: boolean;
  /** Soft FK to role.name; NULL = no escalation configured. */
  escalationRole: string | null;
  /** Hours after step.created_at when fn_approval_escalate may fire. > 0 if set. */
  escalationAfterHours: number | null;
  /** ISO-8601 timestamp — audit. */
  createdAt: string;
  /** ISO-8601 timestamp — audit. */
  updatedAt: string;
}

/** Per-rule shape inside the CreateApprovalMatrixDto / UpdateApprovalMatrixDto rules array. */
export interface ApprovalMatrixRuleInput {
  /** 1..N continuous (AC-S5-02). */
  stepOrder: number;
  /** Optional. If provided, MUST equal stepOrder (AC-S5-05). */
  parallelGroup?: number;
  /** role.name — validated against role table at fn_ time (AC-S5-03). */
  approverRole: string;
  /** Defaults TRUE on the DB column; explicitly captured for clarity. */
  isRequired?: boolean;
  /** Optional. If provided, MUST exist in role.name. */
  escalationRole?: string;
  /** Optional. If provided, MUST be > 0. */
  escalationAfterHours?: number;
}

export interface UpdateApprovalMatrixDto {
  contractType: string;
  valueMin: number;
  valueMax?: number | null;
  rules: ApprovalMatrixRuleInput[];
}

export type CreateApprovalMatrixDto = UpdateApprovalMatrixDto;

export interface ApprovalMatrixListQuery {
  page?: number;
  limit?: number;
  contractType?: string;
}

export type ApprovalMatrixListResponse = Paginated<ApprovalMatrix>;

export interface ApprovalMatrixSetResponse {
  contractType: string;
  minValueAed: number;
  maxValueAed: number | null;
  ruleCount: number;
  ruleIds: number[];
}

// ------------------------------------------------------------
// 4. approval_chain entity + detail (S6 / S7 / S10 / S11)
// ------------------------------------------------------------

/** SENSITIVE element shape inside approval_chain.matrix_snapshot. */
export interface ApprovalMatrixSnapshotEntry {
  stepOrder: number;
  parallelGroup: number | null;
  approverRole: string;
  isRequired: boolean;
  escalationRole: string | null;
  escalationAfterHours: number | null;
}

export interface ApprovalChainGetResponseChain {
  id: number;
  contractId: number;
  status: ApprovalChainStatus;
  currentStepOrder: number;
  submittedBy: UserRef;
  submittedAt: string;
  completedAt: string | null;
}

/** Per-decision shape embedded in step.decisions[].
 * SENSITIVE: decisionNote is in fn_audit_trigger redact list. */
export interface ApprovalChainStepDecisionItem {
  id: number;
  decision: ApprovalDecisionType;
  /** Required for reject + request_resubmission (AC-S2-02/03). */
  decisionNote: string | null;
  decidedBy: UserRef;
  decidedAt: string;
}

export interface ApprovalChainStepDetail {
  id: number;
  stepOrder: number;
  parallelGroup: number | null;
  approverRole: string;
  approverUser: UserRef | null;
  status: ApprovalStepStatus;
  isRequired: boolean;
  escalationRole: string | null;
  escalationAfterHours: number | null;
  reassignedTo: UserRef | null;
  delegatedTo: UserRef | null;
  /** Ordered by decided_at ASC (AC-S10-05). */
  decisions: ApprovalChainStepDecisionItem[];
}

export interface ApprovalChainDetail {
  chain: ApprovalChainGetResponseChain;
  steps: ApprovalChainStepDetail[];
}

export type ApprovalChainGetResponse = ApprovalChainDetail;

export interface ApprovalChainListItem {
  id: number;
  contractId: number;
  contractNumber: string;
  status: ApprovalChainStatus;
  currentStepOrder: number;
  totalSteps: number;
  submittedBy: UserRef;
  submittedAt: string;
  completedAt: string | null;
  /** Hours pending — surfaced as number for FE display; rounded server-side. */
  hoursPending: number;
}

export interface ApprovalChainListQuery {
  page?: number;
  limit?: number;
  contractId?: number;
  status?: ApprovalChainStatus;
  submittedBy?: number;
}

export type ApprovalChainListResponse = Paginated<ApprovalChainListItem>;

// ------------------------------------------------------------
// 5. fn_approval_route_init / preview shapes (S6 + S7)
// ------------------------------------------------------------

export interface RouteInitPreviewStep {
  stepOrder: number;
  parallelGroup: number | null;
  approverRole: string;
  isRequired: boolean;
  escalationRole: string | null;
  escalationAfterHours: number | null;
}

export interface RouteInitPreviewRequest {
  contractType: string;
  valueAed: number;
}

export interface RouteInitPreviewResponse {
  contractType: string;
  valueAed: number;
  steps: RouteInitPreviewStep[];
  hasNoMatchingRule: boolean;
}

/** fn_approval_route_init has no body — empty marker type. */
export type SubmitForApprovalRequest = Record<string, never>;

export interface SubmitForApprovalResponse {
  chainId: number;
  contractId: number;
  totalSteps: number;
  currentStepOrder: number;
  newContractStatus: "in_approval";
}

// ------------------------------------------------------------
// 6. fn_approval_my_pending shapes (S1)
// ------------------------------------------------------------

/**
 * R2 — chain breadcrumb step descriptor (one entry per step in the chain).
 * Used to render the "Legal Counsel → Contract Approver → ..." trail in
 * the inbox row.
 */
export interface ApprovalChainStepRef {
  order: number;
  role: string | null;
  status: "pending" | "approved" | "rejected" | "skipped" | string;
  approverName: string | null;
}

export interface MyPendingApprovalListItem {
  stepId: number;
  chainId: number;
  contractId: number;
  contractNumber: string;
  contractTitleEn: string;
  contractTitleAr: string | null;
  /** R2 — added for inbox Type column. */
  contractType?: string | null;
  valueAed: number | null;
  /** Drafter who initiated the chain. */
  requesterUserRef: UserRef | null;
  stepOrder: number;
  parallelGroup: number | null;
  isRequired: boolean;
  /** EXTRACT(EPOCH FROM (now() - step.created_at)) / 3600. */
  hoursPending: number;
  escalationRole: string | null;
  escalationAfterHours: number | null;
  /** R2 — total step count in the chain (for "Step X of Y" + breadcrumb). */
  totalSteps?: number;
  /** R2 — full chain breadcrumb (all steps, current state). */
  chainSteps?: ApprovalChainStepRef[];
  /**
   * R5 — past-decision fields when this row came from fn_approval_my_decisions.
   * Pending rows leave these undefined.
   */
  decision?: "approve" | "reject" | "request_resubmission" | "skipped";
  decidedAt?: string | null;
  decisionNote?: string | null;
}

export interface MyPendingApprovalListQuery {
  page?: number;
  limit?: number;
  sort?: ApprovalPendingSort;
}

export type MyPendingApprovalListResponse = Paginated<MyPendingApprovalListItem>;

// ------------------------------------------------------------
// 7. Decision / delegate / reassign DTOs (S2 / S3 / S8)
// ------------------------------------------------------------

/** SENSITIVE: decisionNote is pino-redacted on the BE. */
export interface DecideApprovalDto {
  decision: DecideKind;
  /** Required when decision in { reject, request_resubmission }. */
  decisionNote?: string;
}

export interface DecideApprovalResponse {
  stepId: number;
  chainId: number;
  contractId: number;
  newStepStatus: ApprovalStepStatus;
  newChainStatus: ApprovalChainStatus;
  /** 'in_approval' if chain still progressing, else terminal contract status. */
  newContractStatus: ContractStatus;
  /** Next pending step ordinal — NULL if chain halted/completed. */
  advancedToStepOrder: number | null;
  /** TRUE iff chain.status moved out of 'in_progress'. */
  allChainStepsResolved: boolean;
}

export interface DelegateApprovalDto {
  delegatedToUserId: number;
  decisionNote?: string;
}

export interface DelegateApprovalResponse {
  stepId: number;
  delegatedTo: UserRef;
  decisionId: number;
}

export interface ReassignApprovalDto {
  reassignedToUserId: number;
  decisionNote?: string;
}

export interface ReassignApprovalResponse {
  stepId: number;
  /** NULL when the step had no prior approver_user_id (role-only assignment). */
  originalApprover: UserRef | null;
  reassignedTo: UserRef;
  decisionId: number;
}

// ------------------------------------------------------------
// 8. Compile-time tuples for Testing Agent + audit wiring
// ------------------------------------------------------------

export const M2_NEW_PERMISSIONS = [
  "approval.submit_for_review",
  "approval.act",
  "approval.delegate",
  "approval.matrix.read",
  "approval.matrix.write",
  "approval.reassign",
] as const;

export const M2_SENSITIVE_FIELD_EXTENSIONS = [
  "decision_note",
  "matrix_snapshot",
] as const;

// ------------------------------------------------------------
// End of approval.types.ts
// ------------------------------------------------------------
