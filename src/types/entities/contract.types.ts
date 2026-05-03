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

/** 14-state workflow per requirements-analysis.json. M1a only sets/reads. */
export type ContractStatus =
  | "draft"
  | "in_review"
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
  | "resubmission_requested";

export const CONTRACT_STATUS_VALUES: readonly ContractStatus[] = [
  "draft",
  "in_review",
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
];

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

export type ActivityType =
  | "created"
  | "updated"
  | "status_changed"
  | "version_created"
  | "tagged"
  | "soft_deleted"
  | "restored";

export const ACTIVITY_TYPE_VALUES: readonly ActivityType[] = [
  "created",
  "updated",
  "status_changed",
  "version_created",
  "tagged",
  "soft_deleted",
  "restored",
];

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
  tags: string[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
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
