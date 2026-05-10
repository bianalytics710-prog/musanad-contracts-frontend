/**
 * M9 — Counterparty Graph (CR-B) — TypeScript Type Definitions (FE).
 *
 * Mirror of the backend party-graph contract (workspace `types.ts`).
 *
 * Key invariants (preserved here):
 *  - JSONB keys are camelCase (matches every fn_ jsonb_build_object output).
 *  - Closed-set string unions match the DB CHECK constraints byte-for-byte.
 *  - PartyDetail / PartyListItem are SUPERSETS of the legacy M_parity shapes
 *    in `m_parity.service.ts`. Existing M_parity callers stay type-safe via
 *    structural widening.
 *  - sanctions_* fields on PartyDetail are READ-ONLY from any user-facing
 *    path (Q-DA4 lock); fn_party_update silently ignores them. Only the
 *    CR-E rule engine writes via a separate DEFINER carve-out.
 */

import type { EntityReference } from "@/types/entities/osint.types";

// ─── 1. Closed-set string unions (locked enums) ────────────────────────────

/**
 * RelationshipType — party_relationship.relationship_type CHECK enum.
 * 6 values, locked per Q-DA5.
 */
export type RelationshipType =
  | "parent"
  | "ubo"
  | "subsidiary"
  | "sub_contractor"
  | "jv"
  | "controlling_shareholder";

/** Stable order matches the DB CHECK; used by the AddRelationshipDialog dropdown. */
export const RELATIONSHIP_TYPES: ReadonlyArray<RelationshipType> = [
  "parent",
  "ubo",
  "subsidiary",
  "sub_contractor",
  "jv",
  "controlling_shareholder",
] as const;

/** SanctionsStatus — party.sanctions_status CHECK enum. 4 values. */
export type SanctionsStatus =
  | "clean"
  | "flagged"
  | "sanctioned"
  | "under_review";

export const SANCTIONS_STATUSES: ReadonlyArray<SanctionsStatus> = [
  "clean",
  "flagged",
  "sanctioned",
  "under_review",
] as const;

/** IcvStatus — party.icv_status CHECK enum (nullable column). 5 values. */
export type IcvStatus =
  | "certified"
  | "expired"
  | "downgraded"
  | "pending"
  | "none";

export const ICV_STATUSES: ReadonlyArray<IcvStatus> = [
  "certified",
  "expired",
  "downgraded",
  "pending",
  "none",
] as const;

/** RelationshipSource — party_relationship.source CHECK enum. 4 values. */
export type RelationshipSource = "dnb" | "sayari" | "manual" | "demo_seed";

export const RELATIONSHIP_SOURCES: ReadonlyArray<RelationshipSource> = [
  "dnb",
  "sayari",
  "manual",
  "demo_seed",
] as const;

/**
 * ChainHopVia — discriminator on each chain node telling the FE whether
 * the hop came from a party_relationship edge ('edge') or from one of the
 * party self-FK shortcuts ('self_fk_parent' | 'self_fk_ubo').
 */
export type ChainHopVia = "edge" | "self_fk_parent" | "self_fk_ubo";

/** SanctionsMatchType — match-discriminator on PartySanctionsMatchEntry. */
export type SanctionsMatchType =
  | "direct_name"
  | "direct_alias"
  | "chain_ancestor"
  | "chain_descendant";

/** Chain traversal direction. Used by GET /api/v1/parties/:id/chain. */
export type ChainDirection = "up" | "down" | "both";

/** PartyType — re-exported from M_parity. */
export type PartyType = "individual" | "company";

/** PartyAlias — JSONB array element on party.aliases. */
export type PartyAlias = string;

// ─── 2. Party — extended (SUPERSET of M_parity 058 / R-LC 075) ─────────────

/**
 * PartyListItem — projection from fn_party_list (Migration 120 EXTEND).
 * Existing 11 M_parity fields preserved + 6 new badge fields appended.
 */
export interface PartyListItem {
  id: number;
  partyType: PartyType;
  nameEn: string;
  nameAr: string | null;
  tradeLicenseNumber: string | null;
  tradeLicenseIssuer: string | null;
  emirate: string | null;
  freeZone: string | null;
  country: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  isVerified: boolean;
  // M9 (CR-B) badge fields — 6 added in Migration 120
  parentId: number | null;
  aliases: PartyAlias[];
  sanctionsStatus: SanctionsStatus;
  sanctionsLastChecked: string | null;
  icvStatus: IcvStatus | null;
  icvPct: number | null;
}

/**
 * PartyDetail — full fn_party_get_by_id JSONB output (Migration 120 EXTEND).
 * Existing M_parity 058 + R-LC fields preserved verbatim. 11 NEW CR-B
 * fields appended (Q-DA1 lock).
 */
export interface PartyDetail {
  // Existing M_parity 058 + R-LC fields (verbatim)
  id: number;
  partyType: PartyType;
  nameEn: string;
  nameAr: string | null;
  tradeLicenseNumber: string | null;
  tradeLicenseIssuer: string | null;
  emirate: string | null;
  freeZone: string | null;
  country: string;
  contactEmail: string | null;
  contactPhone: string | null;
  registeredAddress: string | null;
  notes: string | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  recentContracts5: Array<{
    id: number;
    contractNumber: string;
    titleEn: string;
    status: string;
    valueAed: number | null;
    updatedAt: string;
  }>;

  // M9 (CR-B) — 11 net-new fields (db-design §4.6)
  parentId: number | null;
  uboId: number | null;
  /** READ-ONLY from FE; written ONLY by CR-E DEFINER fn (Q-DA4 lock). */
  sanctionsStatus: SanctionsStatus;
  sanctionsLastChecked: string | null;
  sanctionsMatchSignalId: number | null;
  esgScore: number | null;
  icvStatus: IcvStatus | null;
  icvPct: number | null;
  icvLastChecked: string | null;
  aliases: PartyAlias[];
  metadata: Record<string, unknown>;
}

/** Alias for PartyDetail used in some BE contracts. */
export type PartyExtended = PartyDetail;

// ─── 3. PartyRelationship — net-new edge entity ────────────────────────────

export interface PartyRelationship {
  id: number;
  tenantId: string;
  parentId: number;
  childId: number;
  relationshipType: RelationshipType;
  ownershipPct: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  source: RelationshipSource;
  confidence: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

/** POST /api/v1/parties/:id/relationships body. */
export interface CreateRelationshipPayload {
  childId: number;
  relationshipType: RelationshipType;
  ownershipPct?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  source?: RelationshipSource;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/** PATCH /api/v1/parties/:id/relationships/:relId body. */
export interface UpdateRelationshipPayload {
  relationshipType?: RelationshipType;
  ownershipPct?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  source?: RelationshipSource;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface RelationshipListEdge {
  id: number;
  relationshipType: RelationshipType;
  ownershipPct: number | null;
  source: RelationshipSource;
  confidence: number;
  createdAt: string;
  otherParty: {
    partyId: number;
    nameEn: string;
    nameAr: string | null;
    sanctionsStatus: SanctionsStatus;
  };
}

export interface ListRelationshipsResponse {
  incoming: RelationshipListEdge[];
  outgoing: RelationshipListEdge[];
  counts: {
    incoming: number;
    outgoing: number;
  };
}

export interface DeleteRelationshipResponse {
  success: true;
  deletedAt: string;
  idempotent: boolean;
}

// ─── 4. Chain traversal ────────────────────────────────────────────────────

export interface PartyChainNode {
  partyId: number;
  depth: number;
  relationshipType: RelationshipType;
  ownershipPct: number | null;
  sanctionsStatus: SanctionsStatus;
  nameEn: string;
  nameAr: string | null;
  via: ChainHopVia;
}

export interface PartyChainTraverseQuery {
  direction?: ChainDirection;
  maxDepth?: number;
}

export interface PartyChainTraverseUpResponse {
  rootPartyId: number;
  ancestors: PartyChainNode[];
  chainTruncated: boolean;
  depthReached: number;
}

export interface PartyChainTraverseDownResponse {
  rootPartyId: number;
  descendants: PartyChainNode[];
  chainTruncated: boolean;
  depthReached: number;
}

export interface PartyChainBothResponse {
  rootPartyId: number;
  ancestors: PartyChainNode[];
  descendants: PartyChainNode[];
  chainTruncated: boolean;
  depthReached: number;
}

export type PartyChainTraverseResponse =
  | PartyChainTraverseUpResponse
  | PartyChainTraverseDownResponse
  | PartyChainBothResponse;

export interface PartyChainSummaryRoot {
  id: number;
  nameEn: string;
  nameAr: string | null;
  sanctionsStatus: SanctionsStatus;
  esgScore: number | null;
  icvStatus: IcvStatus | null;
  icvPct: number | null;
}

/** All 6 keys ALWAYS present, default 0 (AC-S8-03). */
export interface RelationshipTypeCounts {
  parent: number;
  ubo: number;
  subsidiary: number;
  sub_contractor: number;
  jv: number;
  controlling_shareholder: number;
}

export interface PartyChainSummary {
  rootParty: PartyChainSummaryRoot;
  ancestorsByDepth: Record<string, PartyChainNode[]>;
  descendantsByDepth: Record<string, PartyChainNode[]>;
  directRelationshipCounts: RelationshipTypeCounts;
  chainTruncated: boolean;
}

// ─── 5. Sanctions match ────────────────────────────────────────────────────

export interface PartySanctionsMatchInput {
  signalEntities: EntityReference[];
  similarityThreshold?: number;
}

export interface PartySanctionsMatchEntry {
  partyId: number;
  name: string;
  matchedEntityName: string;
  matchType: SanctionsMatchType;
  similarity: number;
  chainPath: Array<{
    partyId: number;
    depth: number;
    relationshipType: RelationshipType;
  }> | null;
}

export interface PartySanctionsMatchResponse {
  matches: PartySanctionsMatchEntry[];
}

// ─── 6. PATCH /api/v1/parties/:id payload (editable subset) ────────────────
//
// fn_party_update is the ONLY writable path for the editable subset of new
// + existing party columns. fn_party_create stays untouched (Q-DA6 lock).
// sanctions_* fields are NOT in this DTO (Q-DA4 lock).
//
// parentId/uboId convention:
//   - omitted (or undefined) → leave unchanged
//   - null                   → BE controller maps to -1 (explicit unset)
//   - <number>               → set to that party id

export interface PartyUpdatePayload {
  // Existing M_parity columns
  nameEn?: string;
  nameAr?: string | null;
  emirate?: string | null;
  freeZone?: string | null;
  country?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  registeredAddress?: string | null;
  notes?: string | null;
  tradeLicenseNumber?: string | null;
  tradeLicenseIssuer?: string | null;

  // M9 (CR-B) editable subset
  parentId?: number | null;
  uboId?: number | null;
  aliases?: PartyAlias[];
  esgScore?: number | null;
  icvStatus?: IcvStatus | null;
  icvPct?: number | null;
  icvLastChecked?: string | null;
  metadata?: Record<string, unknown>;
}

// ─── 7. Convenience re-exports ─────────────────────────────────────────────

export type { EntityReference } from "@/types/entities/osint.types";
