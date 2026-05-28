// ============================================================
// CR-M — Labor-Law Cascade + ADNOC-World Foundation
// TypeScript Type Definitions (FE copy)
// Derived from: contracts.md §Part 1 (Agent 5 output)
// Do not edit manually — regenerate via Agent 5 if DB design changes.
// ============================================================

import type { ApiResponse } from '../api.types';

// -----------------------------------------------------------
// 1. Closed-set string unions (locked DB CHECK enums)
// -----------------------------------------------------------

/**
 * headcount_band — statutory 3-value band per Federal Decree-Law No.9/2024.
 * '<20' = exempt from Emiratisation quota;
 * '20-49' = new band: >=1 Emirati by end-2024, 2 by 2025;
 * '50+' = existing annual % quota band.
 */
export type HeadcountBand = '<20' | '20-49' | '50+';

/** Iterable constant for FE dropdowns / cascade filter chips. */
export const HEADCOUNT_BANDS: ReadonlyArray<HeadcountBand> = [
  '<20',
  '20-49',
  '50+',
] as const;

/**
 * party_workforce.category — contractor service category.
 */
export type WorkforceCategory =
  | 'drilling'
  | 'logistics'
  | 'epc'
  | 'operational_support'
  | 'other';

/**
 * party_workforce.source — provenance of the workforce record.
 */
export type WorkforceSource = 'manual' | 'demo_seed' | 'import';

/**
 * data_classification for cascade records.
 */
export type DataClassification = 'demo' | 'pilot' | 'production';

/**
 * regulatory_cascade_item.remediation_status — lifecycle of per-contractor remediation.
 */
export type RemediationStatus =
  | 'pending'
  | 'in_progress'
  | 'amended'
  | 'dismissed'
  | 'resolved';

/** Iterable constant for FE status filter chips. */
export const REMEDIATION_STATUSES: ReadonlyArray<RemediationStatus> = [
  'pending',
  'in_progress',
  'amended',
  'dismissed',
  'resolved',
] as const;

/**
 * regulatory_cascade_run.status — header status.
 */
export type CascadeRunStatus = 'running' | 'completed' | 'failed';

// -----------------------------------------------------------
// 2. Nested JSONB sub-shapes
// -----------------------------------------------------------

/**
 * penalty_basis JSONB — derivation trace stored per cascade item.
 * SENSITIVE — included in API for compliance_esg workflow pane only.
 */
export interface PenaltyBasis {
  band: HeadcountBand;
  emiratisationGap: number;
  finePerHeadMin: number;
  finePerHeadMax: number;
  statutoryFloor: number;
  statutoryCeiling: number;
}

/**
 * CascadeBandCountEntry — per-band row inside summary.byBand.
 */
export interface CascadeBandCountEntry {
  total: number;
  nonCompliant: number;
  compliant: number;
  totalPenaltyMinAed: number;
  totalPenaltyMaxAed: number;
}

/**
 * CascadeSummaryByBand — the byBand map in regulatory_cascade_run.summary.
 */
export type CascadeSummaryByBand = {
  [K in HeadcountBand]?: CascadeBandCountEntry;
};

/**
 * CascadeSummaryTotals — the totals object in regulatory_cascade_run.summary.
 */
export interface CascadeSummaryTotals {
  affectedContractors: number;
  totalPenaltyMinAed: number;
  totalPenaltyMaxAed: number;
  nonCompliantCount: number;
}

/**
 * CascadeSummary — JSONB shape of regulatory_cascade_run.summary column.
 */
export interface CascadeSummary {
  byBand: CascadeSummaryByBand;
  totals: CascadeSummaryTotals;
  generatedAt: string;
}

// -----------------------------------------------------------
// 3. PartyWorkforce entity
// -----------------------------------------------------------

/**
 * PartyWorkforce — base entity from fn_party_workforce_get JSONB output.
 */
export interface PartyWorkforce {
  id: number;
  partyId: number;
  partyNameEn: string;
  partyNameAr: string | null;
  headcount: number;
  headcountBand: HeadcountBand;
  emiratisationTarget: number;
  emiratisationActual: number;
  isCompliant: boolean;
  category: WorkforceCategory;
  source: WorkforceSource;
  updatedAt: string;
}

/** PartyWorkforceListItem — list projection (same shape as base entity). */
export type PartyWorkforceListItem = PartyWorkforce;

/**
 * Offset-based pagination for workforce and cascade list fns.
 */
export interface OffsetPagination {
  total: number;
  limit: number;
  offset: number;
}

export interface PartyWorkforceListResponse {
  data: PartyWorkforceListItem[];
  pagination: OffsetPagination;
}

/**
 * SetPartyWorkforceDto — request body for POST /api/v1/parties/:partyId/workforce.
 * headcountBand and isCompliant are derived server-side.
 */
export interface SetPartyWorkforceDto {
  headcount: number;
  emiratisationTarget: number;
  emiratisationActual: number;
  category?: WorkforceCategory;
  notes?: string;
}

// -----------------------------------------------------------
// 4. RegulatoryCascadeRun entity
// -----------------------------------------------------------

/**
 * RegulatoryCascadeRunListItem — light projection from fn_regulatory_cascade_list.
 */
export interface RegulatoryCascadeRunListItem {
  id: number;
  signalId: number;
  regulationRef: string | null;
  status: CascadeRunStatus;
  runAt: string;
  affectedContractorCount: number;
  totalPenaltyMinAed: number;
  totalPenaltyMaxAed: number;
  summary: CascadeSummary;
  createdByName: string | null;
}

/**
 * RegulatoryCascadeItemDetail — per-contractor item from fn_regulatory_cascade_get.
 */
export interface RegulatoryCascadeItemDetail {
  id: number;
  partyId: number;
  contractorNameEn: string;
  contractorNameAr: string | null;
  emirate: string | null;
  headcountBand: HeadcountBand;
  isCompliant: boolean;
  emiratisationGap: number;
  affectedClauseCount: number;
  affectedClauseIds: number[];
  affectedContractIds: number[];
  icvAttachmentIds: number[];
  icvAttachmentCount: number;
  penaltyExposureMinAed: number;
  penaltyExposureMaxAed: number;
  /** SENSITIVE — penalty derivation rationale for compliance_esg workflow. */
  penaltyBasis: PenaltyBasis;
  remediationStatus: RemediationStatus;
  advisoryDraftId: number | null;
  advisoryDraftStatus: string | null;
}

/**
 * RegulatoryCascadeRun — full run detail with items array.
 */
export interface RegulatoryCascadeRun {
  id: number;
  tenantId: string;
  signalId: number;
  regulationRef: string | null;
  status: CascadeRunStatus;
  summary: CascadeSummary;
  params: Record<string, unknown>;
  affectedContractorCount: number;
  totalPenaltyMinAed: number;
  totalPenaltyMaxAed: number;
  dataClassification: DataClassification;
  runAt: string;
  createdAt: string;
  createdByName: string | null;
  items: RegulatoryCascadeItemDetail[];
}

/**
 * RegulatoryCascadeRunListResponse — paginated envelope from fn_regulatory_cascade_list.
 */
export interface RegulatoryCascadeRunListResponse {
  data: RegulatoryCascadeRunListItem[];
  pagination: OffsetPagination;
}

// -----------------------------------------------------------
// 5. Request DTOs
// -----------------------------------------------------------

/**
 * RunRegulatoryCascadeDto — POST /api/v1/regulatory/cascade/run.
 */
export interface RunRegulatoryCascadeDto {
  signalId: number;
  impactSignalId?: number;
  params?: {
    employmentClauseTypes?: string[];
  };
}

/**
 * SetRemediationStatusDto — PATCH /api/v1/regulatory/cascade/items/:itemId/status.
 */
export interface SetRemediationStatusDto {
  status: RemediationStatus;
  note?: string | null;
}

/**
 * DraftAmendmentDto — POST /api/v1/regulatory/cascade/items/:itemId/draft-amendment.
 */
export interface DraftAmendmentDto {
  contractId?: number;
}

/**
 * DraftAmendmentResponse — response from POST .../draft-amendment.
 */
export interface DraftAmendmentResponse {
  draftId: number;
  correlationId: number;
  templateId: number;
  contractId: number | null;
  approvalStatus: string;
  remediationStatus: RemediationStatus;
  itemId: number;
}

// -----------------------------------------------------------
// 6. Query shapes
// -----------------------------------------------------------

export interface PartyWorkforceListQuery {
  band?: HeadcountBand;
  compliant?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface RegulatoryCascadeListQuery {
  signalId?: number;
  limit?: number;
  offset?: number;
}

// -----------------------------------------------------------
// 7. Response envelope aliases
// -----------------------------------------------------------

export type PartyWorkforceApiResponse = ApiResponse<PartyWorkforce>;
export type PartyWorkforceListEnvelope = ApiResponse<PartyWorkforceListResponse>;
export type RunCascadeResponse = ApiResponse<RegulatoryCascadeRun>;
export type CascadeListEnvelope = ApiResponse<RegulatoryCascadeRunListResponse>;
export type CascadeDetailEnvelope = ApiResponse<RegulatoryCascadeRun>;
export type DraftAmendmentEnvelope = ApiResponse<DraftAmendmentResponse>;
export type SetRemediationStatusEnvelope = ApiResponse<RegulatoryCascadeItemDetail>;
