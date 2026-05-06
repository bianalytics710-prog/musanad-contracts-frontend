// ============================================================
// M1a — Contracts: Core CRUD & Lifecycle — TypeScript Type Definitions
// Project: Musanad Contracts Hub (musanad-contracts)
// Source of truth: .claude/workspace/current-module/types.ts (Agent 5)
//
// Imports M0 envelope/audit types from the existing api.types.ts.
// JSONB output keys are camelCase; date/time fields are ISO-8601 strings.
// Sensitive bodyEn/bodyAr appear in API responses but MUST NOT be logged.
// ============================================================

import type { Paginated, SensitiveFieldName as M0SensitiveFieldName } from "@/types/api.types";

// ------------------------------------------------------------
// 1. SENSITIVE_FIELD_NAMES extension
// ------------------------------------------------------------

export const M1A_SENSITIVE_FIELD_EXTENSIONS = ["body_en", "body_ar"] as const;
export type M1aSensitiveFieldName = (typeof M1A_SENSITIVE_FIELD_EXTENSIONS)[number];
export type SensitiveFieldName = M0SensitiveFieldName | M1aSensitiveFieldName;

// ------------------------------------------------------------
// 2. Enum union types
// ------------------------------------------------------------

/**
 * Contract status union — M1a 14 values + M2 2 additions (AE-3).
 *
 * M2 migration 023 widens contract_status_check from 14 → 16:
 *   - 'in_approval' — chain in flight (set by fn_approval_route_init).
 *   - 'cancelled'   — drafter / admin abort (set by fn_contract_status_update_user).
 */
export type ContractStatus =
  | "draft"
  | "in_review"
  | "in_approval"
  | "approved"
  | "awaiting_signature_employer"
  | "awaiting_signature_counterparty"
  | "fully_signed"
  | "active"
  | "expiring_soon"
  | "expired"
  | "amended"
  | "renewed"
  | "terminated"
  | "rejected"
  | "resubmission_requested"
  | "cancelled";

export const CONTRACT_STATUS_VALUES: readonly ContractStatus[] = [
  "draft",
  "in_review",
  "in_approval",
  "approved",
  "awaiting_signature_employer",
  "awaiting_signature_counterparty",
  "fully_signed",
  "active",
  "expiring_soon",
  "expired",
  "amended",
  "renewed",
  "terminated",
  "rejected",
  "resubmission_requested",
  "cancelled",
];

/** M2 / AE-3 new statuses — surfaced separately for narrow-transition logic. */
export const M2_CONTRACT_STATUS_EXTENSIONS = ["in_approval", "cancelled"] as const;

export type ContractLanguage = "en" | "ar" | "bilingual";

export const CONTRACT_LANGUAGE_VALUES: readonly ContractLanguage[] = ["en", "ar", "bilingual"];

export type GoverningLaw =
  | "uae_federal"
  | "dubai"
  | "abu_dhabi"
  | "sharjah"
  | "difc"
  | "adgm"
  | "english"
  | "other";

export const GOVERNING_LAW_VALUES: readonly GoverningLaw[] = [
  "uae_federal",
  "dubai",
  "abu_dhabi",
  "sharjah",
  "difc",
  "adgm",
  "english",
  "other",
];

export type RelationshipType =
  | "amendment"
  | "renewal"
  | "extension"
  | "superseded"
  | "sow_under_msa";

export const RELATIONSHIP_TYPE_VALUES: readonly RelationshipType[] = [
  "amendment",
  "renewal",
  "extension",
  "superseded",
  "sow_under_msa",
];

/**
 * Contract activity type union — M1a 7 + M1b 2 + M2 5 + M3 6 = 20 values.
 *
 * M2 migration 027 extends the fn_contract_activity_create whitelist with
 * 5 namespace-prefixed approval activity types (per OI-3).
 * M3 migration 032 extends the whitelist with 6 signature-namespace types
 * (AC-S14-01 / collision-report AE-1).
 */
export type ActivityType =
  | "created"
  | "updated"
  | "status_changed"
  | "version_created"
  | "tagged"
  | "soft_deleted"
  | "restored"
  // M1b additive extensions
  | "import_batch_started"
  | "import_batch_completed"
  // M2 additive extensions (AE-1)
  | "submitted_for_approval"
  | "approval_decided"
  | "approval_reassigned"
  | "approval_escalated"
  | "approval_delegated"
  // M3 additive extensions (signature lifecycle)
  | "sent_for_signature"
  | "signer_viewed"
  | "signer_signed"
  | "signer_declined"
  | "fully_executed"
  | "signature_invalidated";

export const ACTIVITY_TYPE_VALUES: readonly ActivityType[] = [
  "created",
  "updated",
  "status_changed",
  "version_created",
  "tagged",
  "soft_deleted",
  "restored",
  "import_batch_started",
  "import_batch_completed",
  "submitted_for_approval",
  "approval_decided",
  "approval_reassigned",
  "approval_escalated",
  "approval_delegated",
  "sent_for_signature",
  "signer_viewed",
  "signer_signed",
  "signer_declined",
  "fully_executed",
  "signature_invalidated",
];

export const M2_ACTIVITY_TYPE_EXTENSIONS = [
  "submitted_for_approval",
  "approval_decided",
  "approval_reassigned",
  "approval_escalated",
  "approval_delegated",
] as const;

export const M3_ACTIVITY_TYPE_EXTENSIONS = [
  "sent_for_signature",
  "signer_viewed",
  "signer_signed",
  "signer_declined",
  "fully_executed",
  "signature_invalidated",
] as const;

export type ContractRoleKey =
  | "platform_admin"
  | "legal_counsel"
  | "contract_drafter"
  | "contract_approver"
  | "contract_approver_2"
  | "contract_recipient"
  | "executive";

export type ContractPermissionCode =
  | "contract.read.all"
  | "contract.read.department"
  | "contract.read.own"
  | "contract.draft"
  | "contract.edit"
  | "contract.delete"
  | "contract.export"
  | "contract.tag.manage"
  | "contract.status.update";

// ------------------------------------------------------------
// 3. Sub-shapes
// ------------------------------------------------------------

export interface UserRef {
  id: number;
  firstName: string;
  lastName: string;
}

// ------------------------------------------------------------
// 4. Contract entity types
// ------------------------------------------------------------

export interface Contract {
  id: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  contractType: string;
  templateId: number | null;
  status: ContractStatus;
  language: ContractLanguage;
  ourPartyId: number | null;
  counterpartyId: number | null;
  valueAed: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  signedAt: string | null;
  expiryNoticeDays: number;
  emirate: string | null;
  governingLaw: GoverningLaw | null;
  jurisdictionCourt: string | null;
  parentContractId: number | null;
  relationshipType: RelationshipType | null;
  /** SENSITIVE — never log. */
  bodyEn: string | null;
  /** SENSITIVE — never log. */
  bodyAr: string | null;
  currentVersion: number;
  draftedBy: UserRef | null;
  reviewedBy: UserRef | null;
  approvedBy: UserRef | null;
  tags: string[];
  attachmentCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractListItem {
  id: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
  contractType: string;
  status: ContractStatus;
  valueAed: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  counterpartyId: number | null;
  ourPartyId: number | null;
  /** R-LC6 LC-D1 — counterparty name (resolved BE-side). */
  counterpartyNameEn?: string | null;
  counterpartyNameAr?: string | null;
  /** R-LC6 LC-D2 — primary signatory (drafter or creator). */
  signatoryFirstName?: string | null;
  signatoryLastName?: string | null;
  tags: string[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  // ─── M1c additive extension (AE-1 / AE-2) ──────────────────────────────
  // Always present; null when the contract was not bulk-imported.
  /** import_batch.id this contract was created against. */
  importBatchId: number | null;
  /** 0..100 AI extraction confidence. Null when not extracted. */
  importConfidence: number | null;
  /** Human-readable AI warnings array. Null when none. */
  importWarnings: string[] | null;
}

export interface ContractTag {
  id: number;
  contractId: number;
  tag: string;
  createdAt: string;
  createdBy: number | null;
  isActive: boolean;
}

// ------------------------------------------------------------
// 5. ContractVersion entity types
// ------------------------------------------------------------

export interface ContractVersion {
  id: number;
  versionNumber: number;
  /** SENSITIVE — never log. */
  bodyEn: string | null;
  /** SENSITIVE — never log. */
  bodyAr: string | null;
  diffSummary: string | null;
  changeNote: string | null;
  changedBy: UserRef | null;
  createdAt: string;
}

export interface ContractVersionCreated {
  id: number;
  versionNumber: number;
  contractId: number;
  createdAt: string;
}

// ------------------------------------------------------------
// 6. ContractActivity entity types
// ------------------------------------------------------------

export type ContractActivityMetadata =
  | { fromStatus: ContractStatus; toStatus: ContractStatus; reason?: string | null }
  | { versionNumber: number }
  | { added: string[]; removed: string[] }
  | Record<string, unknown>;

export interface ContractActivity {
  id: number;
  activityType: ActivityType;
  actor: UserRef | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  metadata: ContractActivityMetadata | null;
  createdAt: string;
}

// ------------------------------------------------------------
// 7. Request DTOs
// ------------------------------------------------------------

export interface CreateContractDto {
  titleEn: string;
  titleAr?: string | null;
  contractType: string;
  templateId?: number | null;
  language?: ContractLanguage;
  ourPartyId?: number | null;
  counterpartyId?: number | null;
  valueAed?: number | null;
  currency?: string;
  startDate?: string | null;
  endDate?: string | null;
  expiryNoticeDays?: number;
  emirate?: string | null;
  governingLaw?: GoverningLaw | null;
  jurisdictionCourt?: string | null;
  parentContractId?: number | null;
  relationshipType?: RelationshipType | null;
  bodyEn?: string | null;
  bodyAr?: string | null;
  tags?: string[];
  // ─── M1c additive extension (OI-2 / AC-S5-08 / AC-S7-04) ───────────────
  /** import_batch.id this contract was created against. */
  importBatchId?: number;
  /** Original uploaded filename — captured on contract.import_filename. */
  importFilename?: string;
  /** 0..100 AI extraction confidence. */
  importConfidence?: number;
  /** AI extraction warnings (string array). */
  importWarnings?: string[];
}

export interface UpdateContractDto {
  titleEn?: string;
  titleAr?: string | null;
  contractType?: string;
  templateId?: number | null;
  language?: ContractLanguage;
  ourPartyId?: number | null;
  counterpartyId?: number | null;
  valueAed?: number | null;
  currency?: string;
  startDate?: string | null;
  endDate?: string | null;
  expiryNoticeDays?: number;
  emirate?: string | null;
  governingLaw?: GoverningLaw | null;
  jurisdictionCourt?: string | null;
  parentContractId?: number | null;
  relationshipType?: RelationshipType | null;
  bodyEn?: string | null;
  bodyAr?: string | null;
  // tags handled via PUT /contracts/:id/tags
  // status handled via PATCH /contracts/:id/status
}

export interface UpdateContractStatusDto {
  newStatus: ContractStatus;
  reason?: string | null;
}

/**
 * M2 / AE-2 — supersedes M1a UpdateContractStatusDto on the wire.
 *
 * Same fields. Narrower transition matrix enforced server-side by
 * fn_contract_status_update_user. The FE additionally limits the visible
 * targets (see UPDATE_CONTRACT_STATUS_USER_TARGETS) to keep the UX in
 * sync with the BE allowed set.
 *
 * Allowed transitions (server-enforced):
 *   draft        → in_review                (approval.submit_for_review)
 *   in_review    → in_approval              (atomic — internally calls fn_approval_route_init)
 *   in_review    → draft                    (own + approval.submit_for_review OR contract.delete)
 *   approved     → active                   (contract.edit)
 *   <non-terminal> → cancelled              (contract.delete OR own + contract.draft)
 *   rejected     → draft                    (resubmission — drafter)
 *
 * REJECTED at this endpoint:
 *   in_approval  → approved | rejected | resubmission_requested
 *     → 409 with hint "Use fn_approval_decide for in_approval transitions".
 */
export type UpdateContractStatusUserDto = UpdateContractStatusDto;

/**
 * Whitelist of narrow targets the FE will surface for PATCH /contracts/:id/status.
 * Each entry maps a source status → list of targets allowed via this endpoint.
 * Source statuses absent from the map are NOT user-transitionable via the
 * FE status menu (only via /submit-for-approval, /decide, etc.).
 */
export const UPDATE_CONTRACT_STATUS_USER_TARGETS: Readonly<
  Partial<Record<ContractStatus, readonly ContractStatus[]>>
> = {
  draft: ["in_review", "cancelled"],
  in_review: ["draft", "in_approval", "cancelled"],
  approved: ["active", "cancelled"],
  rejected: ["draft", "cancelled"],
  resubmission_requested: ["draft", "cancelled"],
};

export interface SetContractTagsDto {
  tags: string[];
}

export interface CreateContractVersionDto {
  bodyEn?: string | null;
  bodyAr?: string | null;
  diffSummary?: string | null;
  changeNote: string;
}

// ------------------------------------------------------------
// 8. Query parameters
// ------------------------------------------------------------

export interface ContractListQuery {
  page?: number;
  limit?: number;
  status?: ContractStatus;
  contractType?: string;
  counterpartyId?: number;
  draftedBy?: number;
  approvedBy?: number;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  /** AND-semantics — all tags must match. */
  tags?: string[];
  search?: string;
  // ─── M1c additive extension (AE-1) ────────────────────────────────────
  /** Filter to a single import_batch — S4 admin drill-down (AC-S4-05). */
  importBatchId?: number;
  /** Lower bound on contract.import_confidence. Range [0, 100]. AC-S6-01. */
  importConfidenceMin?: number;
  /** Upper bound on contract.import_confidence. Range [0, 100]. AC-S6-01. */
  importConfidenceMax?: number;
  // ─── R5+ Lovable parity filters ────────────────────────────────────
  language?: ContractLanguage;
  governingLaw?: GoverningLaw;
  sort?: "updated_at" | "created_at" | "end_date" | "value" | "alpha";
}

export interface ContractVersionListQuery {
  page?: number;
  limit?: number;
}

export interface ContractActivityListQuery {
  page?: number;
  limit?: number;
  activityType?: ActivityType;
}

// ------------------------------------------------------------
// 9. Response payload types
// ------------------------------------------------------------

export type ContractListResponse = Paginated<ContractListItem>;
export type ContractResponse = Contract;
export type CreateContractResponse = Contract;
export type UpdateContractResponse = Contract;

export interface DeleteContractResponse {
  success: true;
  id: number;
  message: string;
}

export interface UpdateContractStatusResponse {
  id: number;
  fromStatus: ContractStatus;
  toStatus: ContractStatus;
  changedAt: string;
}

export interface ContractTreeNode {
  id: number;
  contractNumber: string;
  titleEn: string;
  status: ContractStatus;
  parentContractId: number | null;
  relationshipType: RelationshipType | null;
  createdAt: string;
  depth: number;
}

export interface ContractTreeResponse {
  rootId: number;
  tree: ContractTreeNode[];
  currentNode: number;
  truncated: boolean;
}

export interface SetContractTagsResponse {
  id: number;
  tags: string[];
}

export type ContractVersionListResponse = Paginated<ContractVersion>;
export type CreateContractVersionResponse = ContractVersionCreated;
export type ContractActivityListResponse = Paginated<ContractActivity>;

// ------------------------------------------------------------
// 10. Type guards
// ------------------------------------------------------------

export function isStatusChangedMetadata(
  m: ContractActivityMetadata | null,
): m is { fromStatus: ContractStatus; toStatus: ContractStatus; reason?: string | null } {
  return m !== null && typeof m === "object" && "fromStatus" in m && "toStatus" in m;
}

export function isVersionCreatedMetadata(
  m: ContractActivityMetadata | null,
): m is { versionNumber: number } {
  return m !== null && typeof m === "object" && "versionNumber" in m && !("fromStatus" in m);
}

export function isTaggedMetadata(
  m: ContractActivityMetadata | null,
): m is { added: string[]; removed: string[] } {
  return m !== null && typeof m === "object" && "added" in m && "removed" in m;
}
