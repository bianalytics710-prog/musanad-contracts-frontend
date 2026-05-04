/**
 * Musanad — Import Batch types (M1c).
 *
 * Mirrors BE src/types/import-batch.types.ts (workspace types.ts §3-§6, §8).
 *
 * Owns:
 *   - import_batch lifecycle types + CRUD shapes
 *   - AI-extraction-bulk stub DTO (frozen for M4 replacement)
 *   - IMPORT_CONFIDENCE_THRESHOLDS — single source of truth for routing
 *   - M1C_NEW_PERMISSIONS — feature gates
 *
 * JSONB output keys are camelCase (matches fn_ output). Date/time fields
 * are ISO-8601 strings — UI uses formatDateTime (Asia/Dubai) for display.
 *
 * Sensitive — extractedText is `ai_prompt_payload` per project.config.json
 * sensitiveFields. Never console.log or persist outside the request body.
 */

import type { Paginated } from "@/types/api.types";
import type {
  ContractLanguage,
  GoverningLaw,
  RelationshipType,
  UserRef,
} from "@/types/entities/contract.types";

// ─── 1. Lifecycle enums ──────────────────────────────────────────────────────

/**
 * 4-value lifecycle enum for import_batch.status (DB CHECK constraint).
 *
 * Allowed transitions (AC-S2-02):
 *   in_progress -> paused | completed | cancelled
 *   paused      -> in_progress | completed | cancelled
 *   completed   -> (terminal)
 *   cancelled   -> (terminal)
 */
export type ImportBatchStatus =
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export const IMPORT_BATCH_STATUS_VALUES: readonly ImportBatchStatus[] = [
  "in_progress",
  "paused",
  "completed",
  "cancelled",
];

/**
 * 3-value enum for import_batch.config.statusMode.
 *   active — every imported contract lands with status='active'
 *   draft  — every imported contract lands with status='draft'
 *   auto   — use AI-detected status from extract-contract-bulk
 */
export type ImportBatchStatusMode = "active" | "draft" | "auto";

export const IMPORT_BATCH_STATUS_MODE_VALUES: readonly ImportBatchStatusMode[] =
  ["active", "draft", "auto"];

// ─── 2. Core entity shapes ───────────────────────────────────────────────────

/**
 * ImportBatchConfig — JSONB shape stored in import_batch.config column.
 */
export interface ImportBatchConfig {
  contractType?: string;
  statusMode: ImportBatchStatusMode;
  defaultCounterpartyId?: number;
}

/**
 * ImportBatch — full shape returned by fn_import_batch_get_by_id.
 *
 * initiatedBy is hydrated as UserRef via M0 fn_user_get_by_id (AC-S4-04).
 * The 5-counter sum is bounded by chk_import_batch_counter_sum
 * (AC-S2-05 overflow guard).
 */
export interface ImportBatch {
  id: number;
  initiatedBy: UserRef;
  config: ImportBatchConfig;
  totalFiles: number;
  autoSaved: number;
  reviewQueue: number;
  manualEntry: number;
  duplicatesSkipped: number;
  errored: number;
  status: ImportBatchStatus;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * ImportBatchListItem — list-row shape from fn_import_batch_list.
 *
 * initiatedBy is the raw bigint user id (NOT a UserRef) to keep the admin
 * list query lean. Drill down via GET /api/v1/import-batches/:id (S4) for
 * the hydrated UserRef.
 */
export interface ImportBatchListItem {
  id: number;
  initiatedBy: number;
  totalFiles: number;
  autoSaved: number;
  reviewQueue: number;
  manualEntry: number;
  duplicatesSkipped: number;
  errored: number;
  status: ImportBatchStatus;
  config: ImportBatchConfig;
  startedAt: string;
  completedAt: string | null;
}

/** Alias of ImportBatch for the GET-by-id consumer. */
export type ImportBatchDetail = ImportBatch;

// ─── 3. DTOs (controller inputs) ─────────────────────────────────────────────

/** POST /api/v1/import-batches body (S1). */
export interface CreateImportBatchDto {
  totalFiles: number;
  config?: ImportBatchConfig;
}

/**
 * PATCH /api/v1/import-batches/:id body (S2).
 *
 * Counter deltas are SIGNED integers (negative deltas allowed iff result
 * remains >= 0 — AC-S2-04). Status transitions validated against allowed
 * set (AC-S2-02). Pass undefined to leave a counter / status unchanged.
 */
export interface UpdateImportBatchDto {
  status?: ImportBatchStatus;
  autoSavedDelta?: number;
  reviewQueueDelta?: number;
  manualEntryDelta?: number;
  duplicatesSkippedDelta?: number;
  erroredDelta?: number;
}

/** GET /api/v1/import-batches query (S3). */
export interface ImportBatchListQuery {
  page?: number;
  limit?: number;
  status?: ImportBatchStatus;
  initiatedBy?: number;
}

// ─── 4. Response shapes ──────────────────────────────────────────────────────

export type ImportBatchListResponse = Paginated<ImportBatchListItem>;
export type ImportBatchResponse = ImportBatch;
export type CreateImportBatchResponse = ImportBatch;
export type UpdateImportBatchResponse = ImportBatch;

// ─── 5. AI extraction stub (S8) — FROZEN DTO ─────────────────────────────────

/**
 * POST /api/v1/ai/extract-contract-bulk request (S8).
 *
 * extractedText is sensitive — pino-redacted at the BE controller as
 * `ai_prompt_payload` per project.config.json sensitiveFields (AC-S8-06).
 * NEVER console.log or persist this field on the client outside the
 * request body itself.
 */
export interface ExtractContractBulkRequest {
  filename: string;
  fileSize: number;
  /** Min 50 characters — AC-S8-03. SENSITIVE — never log. */
  extractedText: string;
  batchId: number;
}

/**
 * POST /api/v1/ai/extract-contract-bulk response (S8).
 *
 * Locked DTO contract — frozen for M4 replacement (AC-S8-07).
 * Field set = M1a CreateContractDto (all optional) + import metadata.
 */
export interface ExtractContractBulkResponse {
  // M1a CreateContractDto fields — all optional (AI may not detect every field).
  titleEn?: string;
  titleAr?: string;
  contractType?: string;
  templateId?: number;
  language?: ContractLanguage;
  ourPartyId?: number;
  counterpartyId?: number;
  valueAed?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  expiryNoticeDays?: number;
  emirate?: string;
  governingLaw?: GoverningLaw;
  jurisdictionCourt?: string;
  parentContractId?: number;
  relationshipType?: RelationshipType;
  bodyEn?: string;
  bodyAr?: string;
  tags?: string[];

  // M1c-specific extraction metadata (REQUIRED).
  /** 0..100. Routes per-file result via IMPORT_CONFIDENCE_THRESHOLDS. */
  importConfidence: number;
  /** Human-readable warnings. Null when no warnings apply. */
  importWarnings: string[] | null;
  /** AI-detected contract number — FE pre-checks against existing actives. */
  detectedDuplicateContractNumber?: string | null;
}

// ─── 6. Confidence routing thresholds (Q5 / AC-S5-05) ────────────────────────

/**
 * Single source of truth for confidence routing in the bulk-import flow.
 * Mirrored verbatim by the BE in src/types/import-batch.types.ts.
 *
 * Routing rule (FE — applied in route-by-confidence helper):
 *   importConfidence >= high   → auto-save track
 *   importConfidence in [medium, high)  → review queue
 *   importConfidence <  medium  → manual entry track
 *
 * Review queue range (AC-S6-01): medium <= confidence < high (50..79).
 */
export const IMPORT_CONFIDENCE_THRESHOLDS = {
  high: 80,
  medium: 50,
  low: 0,
} as const;

export type ImportConfidenceTrack = "auto" | "review" | "manual";

/**
 * Pure routing helper. Same input → same output. M4 routing tests rely on
 * this being deterministic.
 */
export function routeByConfidence(confidence: number): ImportConfidenceTrack {
  if (confidence >= IMPORT_CONFIDENCE_THRESHOLDS.high) return "auto";
  if (confidence >= IMPORT_CONFIDENCE_THRESHOLDS.medium) return "review";
  return "manual";
}

// ─── 7. Permission codes introduced by M1c ───────────────────────────────────

export const M1C_NEW_PERMISSIONS = ["import.run", "import.review"] as const;

export type M1cPermissionCode = (typeof M1C_NEW_PERMISSIONS)[number];
