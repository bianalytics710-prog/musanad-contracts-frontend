// ============================================================
// M5 — Regulatory Radar — TypeScript Type Definitions (FE)
// Mirror of workspace/current-module/types.ts adjusted for the frontend
// import surface (no project-artifacts/ paths; no Contract re-export — the
// FE already owns its own Contract type in contract.types.ts).
// ============================================================
//
// Module:     M5 — Regulatory Radar
// Project:    Musanad Contracts Hub (UAE; bilingual EN/AR)
// Generated:  2026-05-05
// Source:     api-contracts.json + db-design.md (Agent 4 v2.1)
//
// Cross-module touchpoints (FE):
// - Reuses ApiResponse / PaginationMeta from api.types.ts
// - Activity-type union extension lives at module scope here only; the FE
//   does NOT use the M4ActivityType chain pattern at runtime — only the BE
//   does. Frontend code consumes activity-type strings as opaque values
//   from `contract_activity` rows (see contract.types.ts ActivityType).
// - Contract interface is NOT re-exported here — FE imports it from
//   @/types/entities/contract.types when needed.
// - All M5 endpoints are JWT-authed (Q1 lock; Stage 4 expected PUBLIC count = 5).
// ============================================================

import type { ApiResponse, PaginationMeta } from "@/types/api.types";

// ------------------------------------------------------------
// 1. M5 ActivityType extensions — for UI badge rendering only
// ------------------------------------------------------------

export const M5_ACTIVITY_TYPE_EXTENSIONS = [
  "regulatory_impact_detected",
  "regulatory_impact_resolved",
] as const;

export type M5ActivityTypeExtension =
  (typeof M5_ACTIVITY_TYPE_EXTENSIONS)[number];

// ------------------------------------------------------------
// 2. M5 permission codes
// ------------------------------------------------------------

export const M5_NEW_PERMISSIONS = [
  "regulations.read",
  "regulations.manage",
  "config.manage",
] as const;

export type M5PermissionCode = (typeof M5_NEW_PERMISSIONS)[number];

// ------------------------------------------------------------
// 3. Shared enums
// ------------------------------------------------------------

export type RegulationType =
  | "federal_decree_law"
  | "cabinet_resolution"
  | "ministerial_decision"
  | "free_zone_regulation"
  | "circular"
  | "guideline";

export const REGULATION_TYPE_VALUES: readonly RegulationType[] = [
  "federal_decree_law",
  "cabinet_resolution",
  "ministerial_decision",
  "free_zone_regulation",
  "circular",
  "guideline",
];

export type RegulationJurisdiction =
  | "uae_federal"
  | "dubai"
  | "abu_dhabi"
  | "sharjah"
  | "difc"
  | "adgm"
  | "dmcc"
  | "other";

export const REGULATION_JURISDICTION_VALUES: readonly RegulationJurisdiction[] =
  [
    "uae_federal",
    "dubai",
    "abu_dhabi",
    "sharjah",
    "difc",
    "adgm",
    "dmcc",
    "other",
  ];

export type RegulationStatus = "active" | "superseded" | "repealed" | "draft";

export const REGULATION_STATUS_VALUES: readonly RegulationStatus[] = [
  "active",
  "superseded",
  "repealed",
  "draft",
];

export type RegulatorySeverity = "low" | "medium" | "high" | "critical";

export const REGULATORY_SEVERITY_VALUES: readonly RegulatorySeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export type RegulatoryImpactResolutionAction =
  | "amended"
  | "waived"
  | "out_of_scope"
  | "pending";

export const REGULATORY_IMPACT_RESOLUTION_ACTION_VALUES: readonly RegulatoryImpactResolutionAction[] =
  ["amended", "waived", "out_of_scope", "pending"];

export type RegulatoryImpactStatus = "pending" | "resolved";

// ------------------------------------------------------------
// 4. Regulator (read-only embed; M5 has no regulator CRUD — REG-OI-B)
// ------------------------------------------------------------

export interface Regulator {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string | null;
  jurisdiction: RegulationJurisdiction | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  sourceUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface RegulatorRef {
  id: number;
  code: string;
  nameEn: string;
  nameAr?: string | null;
}

// ------------------------------------------------------------
// 5. ImpactCategory (S14 + S15)
// ------------------------------------------------------------

export interface ImpactCategory {
  id: number;
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  icon: string;
  colour: string;
  /** Visibility flag for FE picker — separate from isActive soft-delete. */
  active: boolean;
  displayOrder: number;
  sources: string[];
  /** JSONB array of severity strings — default ["low","medium","high","critical"]. */
  severityScale: string[];
  /** Admin-authored AI guidance content. */
  aiPromptContext: string | null;
  defaultClauseCategories: string[];
}

export interface ImpactCategoryRef {
  id: number;
  key: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  colour: string;
}

export interface UpsertImpactCategoryDto {
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  icon?: string;
  colour?: string;
  active?: boolean;
  displayOrder?: number;
  sources?: string[];
  severityScale?: string[];
  aiPromptContext?: string | null;
  defaultClauseCategories?: string[];
}

export interface ImpactCategoryUpsertResult {
  id: number;
  key: string;
  createdOrUpdated: "created" | "updated";
}

export interface ImpactCategoryListResponse {
  data: ImpactCategory[];
}

export interface ImpactCategoryListQuery {
  includeInactive?: boolean;
}

// ------------------------------------------------------------
// 6. Regulation (S1..S5)
// ------------------------------------------------------------

export interface RegulationSupersededByItem {
  id: number;
  referenceCode: string;
  titleEn: string;
  titleAr: string | null;
  status: RegulationStatus;
  depth: number;
}

export interface RegulationListItem {
  id: number;
  referenceCode: string;
  titleEn: string;
  titleAr: string | null;
  issuer: RegulatorRef;
  regulationType: RegulationType;
  jurisdiction: RegulationJurisdiction | null;
  effectiveDate: string | null;
  supersededByCode: string | null;
  status: RegulationStatus;
  isActive: boolean;
}

export interface Regulation {
  id: number;
  referenceCode: string;
  titleEn: string;
  titleAr: string | null;
  issuer: RegulatorRef;
  regulationType: RegulationType;
  jurisdiction: RegulationJurisdiction | null;
  effectiveDate: string | null;
  summaryEn: string | null;
  summaryAr: string | null;
  sourceUrl: string | null;
  tags: string[];
  status: RegulationStatus;
  isActive: boolean;
  supersededBy: RegulationSupersededByItem[];
}

export interface CreateRegulationDto {
  referenceCode: string;
  titleEn: string;
  titleAr?: string | null;
  issuerId: number;
  regulationType: RegulationType;
  jurisdiction?: RegulationJurisdiction | null;
  effectiveDate?: string | null;
  summaryEn?: string | null;
  summaryAr?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
  status?: RegulationStatus;
}

export interface UpdateRegulationDto {
  titleEn?: string;
  titleAr?: string | null;
  summaryEn?: string | null;
  summaryAr?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
  status?: RegulationStatus;
  /** Auto-flips status to 'superseded' when set (AC-S4-02). */
  supersededById?: number | null;
  regulationType?: RegulationType;
  jurisdiction?: RegulationJurisdiction | null;
  effectiveDate?: string | null;
  issuerId?: number;
}

export interface RegulationCreateResult {
  id: number;
  referenceCode: string;
  createdAt: string;
}

export interface RegulationUpdateResult {
  id: number;
  updatedAt: string;
}

export interface RegulationDeleteResult {
  id: number;
  isActive: false;
}

export interface RegulationListResponse {
  data: RegulationListItem[];
  pagination: PaginationMeta;
}

export interface RegulationListQuery {
  page?: number;
  limit?: number;
  jurisdiction?: RegulationJurisdiction;
  regulationType?: RegulationType;
  issuerId?: number;
  status?: RegulationStatus;
  search?: string;
}

// ------------------------------------------------------------
// 7. Regulatory Update (S6..S10)
// ------------------------------------------------------------

export interface RegulatoryImpactSummary {
  totalImpacts: number;
  resolvedCount: number;
  pendingCount: number;
  /** AC-S7-04 — null when totalImpacts == 0 (avoids div-by-zero). */
  avgImpactScore: number | null;
}

export interface RegulatoryUpdateListItem {
  id: number;
  regulator: RegulatorRef;
  titleEn: string;
  titleAr: string | null;
  summaryEn: string | null;
  summaryAr: string | null;
  referenceNumber: string | null;
  publishedDate: string;
  effectiveDate: string | null;
  complianceDeadline: string | null;
  severity: RegulatorySeverity;
  sourceUrl: string | null;
  affectedClauseCategories: string[];
  category: ImpactCategoryRef | null;
  subSource: string | null;
}

export interface RegulatoryUpdate extends RegulatoryUpdateListItem {
  impactSummary: RegulatoryImpactSummary;
}

export interface CreateRegulatoryUpdateDto {
  regulatorId: number;
  titleEn: string;
  titleAr?: string | null;
  summaryEn?: string | null;
  summaryAr?: string | null;
  referenceNumber?: string | null;
  publishedDate: string;
  effectiveDate?: string | null;
  complianceDeadline?: string | null;
  severity?: RegulatorySeverity;
  sourceUrl?: string | null;
  affectedClauseCategories?: string[];
  categoryId?: number | null;
  subSource?: string | null;
}

export interface UpdateRegulatoryUpdateDto {
  regulatorId?: number;
  titleEn?: string;
  titleAr?: string | null;
  summaryEn?: string | null;
  summaryAr?: string | null;
  referenceNumber?: string | null;
  publishedDate?: string;
  effectiveDate?: string | null;
  complianceDeadline?: string | null;
  severity?: RegulatorySeverity;
  sourceUrl?: string | null;
  affectedClauseCategories?: string[];
  categoryId?: number | null;
  subSource?: string | null;
}

export interface RegulatoryUpdateCreateResult {
  id: number;
  createdAt: string;
}

export interface RegulatoryUpdateUpdateResult {
  id: number;
  updatedAt: string;
}

export interface RegulatoryUpdateDeleteResult {
  id: number;
  isActive: false;
  cascadedImpacts: number;
}

export interface RegulatoryUpdateListResponse {
  data: RegulatoryUpdateListItem[];
  pagination: PaginationMeta;
}

export interface RegulatoryUpdateListQuery {
  page?: number;
  limit?: number;
  regulatorId?: number;
  severity?: RegulatorySeverity;
  categoryId?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  complianceDeadlineMax?: string;
}

// ------------------------------------------------------------
// 8. Regulatory Impact (S11..S13)
// ------------------------------------------------------------

export interface RegulatoryImpactContractRef {
  id: number;
  contractNumber: string;
  titleEn: string;
}

export interface RegulatoryImpactRegulationRef {
  id: number;
  referenceCode: string;
  titleEn: string;
}

export interface RegulatoryImpactRegulatoryUpdateRef {
  id: number;
  titleEn: string;
  severity: RegulatorySeverity;
}

export interface RegulatoryImpact {
  id: number;
  contract: RegulatoryImpactContractRef;
  regulation: RegulatoryImpactRegulationRef;
  /** Q7 — null when this is a structural impact (regulation only). */
  regulatoryUpdate: RegulatoryImpactRegulatoryUpdateRef | null;
  impactScore: number | null;
  impactNoteEn: string | null;
  impactNoteAr: string | null;
  impactSummaryEn: string | null;
  impactSummaryAr: string | null;
  detectedAt: string;
  resolved: boolean;
  resolutionAction: RegulatoryImpactResolutionAction | null;
  resolutionNote: string | null;
}

/**
 * Per-contract payload entry passed to the bulk-detect endpoint.
 * SENSITIVE — never console-log this object.
 */
export interface ImpactPayloadEntry {
  impactScore?: number | null;
  noteEn?: string | null;
  noteAr?: string | null;
  summaryEn?: string | null;
  summaryAr?: string | null;
}

export interface BulkDetectRegulatoryImpactDto {
  regulatoryUpdateId: number;
  regulationId: number;
  /** AC-S11-03 — must be non-empty. */
  contractIds: number[];
  /** Per-contract payload keyed by contractId.toString(). SENSITIVE. */
  impactPayload: Record<string, ImpactPayloadEntry>;
}

export interface BulkDetectRegulatoryImpactResult {
  createdCount: number;
  skippedDuplicateCount: number;
  impactIds: number[];
}

export interface ResolveRegulatoryImpactDto {
  resolutionAction: RegulatoryImpactResolutionAction;
  /** Q8 — admin-bounded free text; AC-S13-07 stored verbatim. */
  resolutionNote?: string | null;
}

export interface RegulatoryImpactResolveResult {
  id: number;
  resolved: boolean;
  resolutionAction: RegulatoryImpactResolutionAction;
  updatedAt: string;
}

export interface RegulatoryImpactListResponse {
  data: RegulatoryImpact[];
  pagination: PaginationMeta;
}

export interface RegulatoryImpactListQuery {
  page?: number;
  limit?: number;
  /** AC-S12-02 — at least one of contractId/regulationId/regulatoryUpdateId required. */
  contractId?: number;
  regulationId?: number;
  regulatoryUpdateId?: number;
  resolved?: boolean;
}

// ------------------------------------------------------------
// 9. Response envelope aliases
// ------------------------------------------------------------

export type RegulationResponse = ApiResponse<Regulation>;
export type RegulationListEnvelope = ApiResponse<RegulationListResponse>;
export type RegulationCreateEnvelope = ApiResponse<RegulationCreateResult>;
export type RegulationUpdateEnvelope = ApiResponse<RegulationUpdateResult>;
export type RegulationDeleteEnvelope = ApiResponse<RegulationDeleteResult>;

export type RegulatoryUpdateResponse = ApiResponse<RegulatoryUpdate>;
export type RegulatoryUpdateListEnvelope = ApiResponse<RegulatoryUpdateListResponse>;
export type RegulatoryUpdateCreateEnvelope = ApiResponse<RegulatoryUpdateCreateResult>;
export type RegulatoryUpdateUpdateEnvelope = ApiResponse<RegulatoryUpdateUpdateResult>;
export type RegulatoryUpdateDeleteEnvelope = ApiResponse<RegulatoryUpdateDeleteResult>;

export type RegulatoryImpactListEnvelope = ApiResponse<RegulatoryImpactListResponse>;
export type RegulatoryImpactBulkDetectEnvelope = ApiResponse<BulkDetectRegulatoryImpactResult>;
export type RegulatoryImpactResolveEnvelope = ApiResponse<RegulatoryImpactResolveResult>;

export type ImpactCategoryListEnvelope = ApiResponse<ImpactCategoryListResponse>;
export type ImpactCategoryUpsertEnvelope = ApiResponse<ImpactCategoryUpsertResult>;
