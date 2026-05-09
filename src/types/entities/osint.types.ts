// ============================================================
// M7 — OSINT Source Framework + Adapter Protocol (CR-A)
// TypeScript Type Definitions
// Derived from: db-design.md (post Stage 2 Patch Round 1) + requirements-analysis.json
// Owned by: M7
// ============================================================

import type { PaginationMeta } from "@/types/api.types";

// ============================================================
// 1. Status / Category String Unions (typed enums)
// ============================================================

export type SourceKind =
  | "sanctions"
  | "news"
  | "weather"
  | "commodity"
  | "fx"
  | "social"
  | "regulatory"
  | "internal";

export type SourceFormat = "xml" | "csv" | "json" | "rss" | "api";

export type SignalKind =
  | "geopolitical"
  | "sanctions"
  | "weather"
  | "commodity"
  | "fx"
  | "logistics"
  | "esg"
  | "regulatory"
  | "news"
  | "internal";

export type Severity =
  | "informational"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type HealthState = "healthy" | "degraded" | "failing" | "unauthorised";

export type CredentialKind = "api_key" | "oauth_token" | "basic_auth" | "none";

export type DataClassification = "demo" | "pilot" | "production";

// ============================================================
// 2. Embedded JSONB Shapes
// ============================================================

export interface RateLimitConfig {
  callsPerMinute: number;
  burst: number;
  minIntervalMs: number;
  respectRetryAfter: boolean;
}

export interface GeoReference {
  isoCountry?: string;
  regionCode?: string;
  free?: string;
}

export interface EntityReference {
  entityType: string;
  name: string;
  identifier?: string;
  partyId?: number;
}

export interface SeverityMappingRule {
  programContains?: string;
  titleContains?: string;
  absChangePctGte?: number;
  pegDeviationPctGte?: number;
  default?: Severity;
  severity?: Severity;
}

export interface SeverityMapping {
  rules: SeverityMappingRule[];
}

export interface GeographyFilter {
  countryIn?: string[];
  themeIn?: string[];
  actorIn?: string[];
}

// ============================================================
// 3. Tenant
// ============================================================

export interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  configPack: string;
}

// ============================================================
// 4. OsintSource
// ============================================================

export interface OsintSource {
  id: number;
  tenantId: string;
  sourceId: string;
  displayName: string;
  displayNameAr: string | null;
  kind: SourceKind;
  url: string | null;
  format: SourceFormat;
  refreshSeconds: number;
  sourceReliability: number;
  enabled: boolean;
  rateLimit: RateLimitConfig | null;
  severityMapping: SeverityMapping | null;
  geographyFilter: GeographyFilter | null;
  licensingNote: string | null;
  metadata: Record<string, unknown>;
  dataClassification: DataClassification;
  createdAt: string;
  updatedAt: string;
}

export interface OsintSourceDetail extends OsintSource {
  health: SourceHealthBadge | null;
  credential: SourceCredentialMetadata | null;
}

export interface OsintSourceListItem extends OsintSource {
  health: SourceHealthBadge | null;
}

export interface OsintSourceListResponse {
  data: OsintSourceListItem[];
  pagination: PaginationMeta;
}

export interface OsintSourceListFilter {
  kind?: SourceKind;
  state?: HealthState;
  search?: string;
}

export interface CreateOsintSourceDto {
  sourceId: string;
  displayName: string;
  displayNameAr?: string;
  kind: SourceKind;
  url?: string;
  format: SourceFormat;
  refreshSeconds: number;
  sourceReliability: number;
  enabled?: boolean;
  rateLimit?: RateLimitConfig;
  severityMapping?: SeverityMapping;
  geographyFilter?: GeographyFilter;
  licensingNote?: string;
  metadata?: Record<string, unknown>;
  dataClassification?: DataClassification;
}

export interface UpdateOsintSourceDto {
  displayName?: string;
  displayNameAr?: string;
  kind?: SourceKind;
  url?: string;
  format?: SourceFormat;
  refreshSeconds?: number;
  sourceReliability?: number;
  enabled?: boolean;
  rateLimit?: RateLimitConfig;
  severityMapping?: SeverityMapping;
  geographyFilter?: GeographyFilter;
  licensingNote?: string;
  metadata?: Record<string, unknown>;
  dataClassification?: DataClassification;
}

export interface DeleteOsintSourceResponse {
  id: number;
  deactivated: boolean;
  message: string;
}

export interface TestPullResponse {
  queued: boolean;
  sourceId: string;
  requestedAt: string;
}

// ============================================================
// 5. SourceCredential
// ============================================================

export interface SetCredentialDto {
  credentialKind: CredentialKind;
  /** Pattern: 'env:VARNAME' OR 'vault:path'. NEVER plain-text secret. */
  credentialRef: string;
}

export interface SetCredentialResponse {
  id: number;
  credentialKind: CredentialKind;
  lastRotatedAt: string;
}

/**
 * SourceCredentialMetadata — embedded credential summary on OsintSourceDetail.
 * NEVER includes credentialRef (AC-S3-04 invariant).
 */
export interface SourceCredentialMetadata {
  kind: CredentialKind;
  lastRotatedAt: string | null;
}

// ============================================================
// 6. OsintSignal
// ============================================================

export interface OsintSignal {
  id: number;
  tenantId: string;
  osintSourceId: number | null;
  sourceId: string;
  sourceReliability: number;
  fetchedAt: string;
  eventDate: string | null;
  kind: SignalKind;
  signalKindSubtype: string | null;
  title: string;
  summary: string | null;
  geographies: GeoReference[];
  affectedEntities: EntityReference[];
  severity: Severity;
  confidence: number;
  url: string | null;
  rawPayload: Record<string, unknown>;
  dedupHash: string;
  dataClassification: DataClassification;
  createdAt: string;
}

export interface OsintSignalListFilter {
  kind?: SignalKind;
  sourceId?: string;
  severityMin?: Severity;
  since?: string;
  geographyIntersects?: string;
  affectedEntityId?: string;
}

export interface OsintSignalListResponse {
  data: OsintSignal[];
  pagination: PaginationMeta;
}

// ============================================================
// 7. SourceHealth
// ============================================================

export interface SourceHealthBadge {
  state: HealthState;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  signals24h: number;
  lastErrorMessage: string | null;
  checkedAt: string;
}

export interface SourceHealthListItem {
  sourceId: string;
  displayName: string;
  kind: SourceKind;
  state: HealthState;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  signals24h: number;
  lastErrorMessage: string | null;
  checkedAt: string;
}
