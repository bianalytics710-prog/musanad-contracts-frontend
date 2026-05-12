/**
 * M11 — Document Ingestion Pipeline (CR-D0) — FE Type Definitions
 * Mirrors workspace/current-module/types.ts (Agent 5 output).
 *
 * F-S2-22 patch applied: contractTitle → contractTitleEn + contractTitleAr
 * Sensitive fields annotated — never log in FE dev tools or errors.
 */

import type { PaginationMeta } from '@/types/api.types';

export type { PaginationMeta };

// ============================================================
// Enum / union types
// ============================================================

export type IngestionStatus =
  | 'pending'
  | 'extracting'
  | 'complete'
  | 'failed'
  | 'partial';

export type ExtractionEngine =
  | 'digital_pdf'
  | 'tesseract'
  | 'gpt4o_vision'
  | 'mammoth_docx'
  | 'mixed';

export type ReviewStatus =
  | 'pending_auto'
  | 'pending_human'
  | 'resolved'
  | 'rejected';

export type IngestionReviewAction = 'confirm' | 'correct' | 'reject';

// ============================================================
// contract_version ingestion extension fields
// ============================================================

export interface ContractVersionIngestionFields {
  /** SENSITIVE — Supabase Storage path; signed URLs only, never log. */
  extractedTextUri: string | null;
  ocrUsed: boolean;
  ocrConfidenceAvg: number | null;
  pageCount: number | null;
  ingestionStatus: IngestionStatus;
  /** SENSITIVE — may contain partial text or stack traces. */
  ingestionError: string | null;
  extractionEngine: ExtractionEngine | null;
  extractedAt: string | null;
  ingestionAttemptCount: number;
}

// ============================================================
// API response shapes
// ============================================================

export interface IngestionQueuedResponse {
  contractVersionId: number;
  ingestionStatus: IngestionStatus;
  queuedAt: string;
  alreadyInProgress: boolean;
}

/**
 * fn_contract_version_ingestion_status JSONB output.
 * extractedTextUri is SENSITIVE — never log.
 */
export interface IngestionStatusResponse {
  contractVersionId: number;
  ingestionStatus: IngestionStatus;
  /** SENSITIVE — may contain partial text or stack traces. */
  ingestionError: string | null;
  pageCount: number | null;
  ocrUsed: boolean;
  ocrConfidenceAvg: number | null;
  extractionEngine: ExtractionEngine | null;
  extractedAt: string | null;
  /** SENSITIVE — raw Storage path. Controller issues signed URL separately. */
  extractedTextUri: string | null;
  /** Count of pending_auto + pending_human review queue rows for this version. */
  lowConfidencePageCount: number;
}

/**
 * GET /extracted-text response.
 * Signed URL valid for exactly 60 seconds.
 */
export interface SignedExtractedTextUrlResponse {
  signedUrl: string;
  expiresAt: string;
  ttlSeconds: 60;
}
