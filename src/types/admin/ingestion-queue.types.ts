/**
 * M11 — Ingestion Review Queue — Admin types.
 * F-S2-22 patch: contractTitleEn + contractTitleAr (NOT contractTitle).
 */

import type { PaginationMeta } from '@/types/api.types';

export type { PaginationMeta };

export type ReviewStatus =
  | 'pending_auto'
  | 'pending_human'
  | 'resolved'
  | 'rejected';

export type DataClassification = 'demo' | 'pilot' | 'production';

export type IngestionReviewAction = 'confirm' | 'correct' | 'reject';

/**
 * Single row returned by fn_ingestion_review_queue_list.
 * F-S2-22: contractTitleEn + contractTitleAr replace contractTitle.
 * tesseract_text / gpt4o_text / final_text are NOT included in list view.
 */
export interface IngestionReviewQueueItem {
  id: number;
  contractVersionId: number;
  /** F-S2-22: title_en from contract (JOIN contract_version → contract). */
  contractTitleEn: string;
  /** F-S2-22: title_ar from contract. */
  contractTitleAr: string | null;
  pageNo: number;
  /** Per-page Tesseract confidence. NULL when page routed to gpt-4o directly. */
  tesseractConfidence: number | null;
  gpt4oUsed: boolean;
  reviewStatus: ReviewStatus;
  /** Reviewer display name. NULL pre-review. */
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  dataClassification: DataClassification;
  tenantId: string;
}

export interface IngestionReviewQueueListResponse {
  data: IngestionReviewQueueItem[];
  pagination: PaginationMeta;
}

export interface AdminIngestionQueueListQuery {
  page?: number;
  limit?: number;
  reviewStatus?: ReviewStatus;
  contractVersionId?: number;
  gpt4oUsed?: boolean;
}

export interface IngestionResolveRequest {
  action: IngestionReviewAction;
  /** Required when action='correct'. SENSITIVE — never log. */
  correctedText?: string;
}

export interface IngestionResolveResult {
  queueId: number;
  reviewStatus: ReviewStatus;
  /** SENSITIVE — reviewer-confirmed text. NULL when action='reject'. */
  finalText: string | null;
  reviewedAt: string;
}
