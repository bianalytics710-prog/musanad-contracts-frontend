/**
 * TPA — Third-Party Agreement Assessment types.
 * Source: api-contracts /api/v1/tpa
 */
import type { PaginationMeta } from '@/types/api.types';

export type AgreementType = 'nda' | 'msa' | 'supply' | 'service' | 'consultancy' | 'epc' | 'spa' | 'other';
export type Criticality = 'non_negotiable' | 'high' | 'medium' | 'low';
export type AiVerdict = 'accept' | 'amend' | 'reject' | 'missing' | 'info';
export type OverallVerdict = 'accept' | 'amend' | 'reject';
export type OverallRisk = 'low' | 'medium' | 'high' | 'critical';
export type ReviewStatus =
  | 'pending_analysis'
  | 'analyzing'
  | 'awaiting_review'
  | 'reviewed'
  | 'redline_sent'
  | 'closed_accepted'
  | 'closed_rejected'
  | 'failed';
export type ResolutionStatus = 'open' | 'accepted_ai' | 'amended_by_user' | 'dismissed' | 'escalated';

export interface PlaybookListItem {
  id: number;
  playbookKey: string;
  agreementType: AgreementType;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  version: number;
  status: string;
  clauseCount: number;
}

export interface PlaybookClause {
  id: number;
  clauseKey: string;
  clauseTitleEn: string;
  clauseTitleAr: string | null;
  criticality: Criticality;
  displayOrder: number;
  standardPosition: string;
  fallbackPosition: string | null;
  nonNegotiables: string[];
  redFlags: string[];
  guidanceNotes: string | null;
}

export interface Playbook {
  id: number;
  playbookKey: string;
  agreementType: AgreementType;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  version: number;
  status: string;
  clauses: PlaybookClause[];
}

export interface ReviewListItem {
  id: number;
  referenceCode: string;
  counterpartyName: string;
  agreementTitle: string;
  agreementType: string;
  status: ReviewStatus;
  overallVerdict: OverallVerdict | null;
  overallRisk: OverallRisk | null;
  riskScore: number | null;
  acceptCount: number;
  amendCount: number;
  rejectCount: number;
  conflictCount: number;
  createdAt: string;
  createdByName: string | null;
  llmAnalysedAt: string | null;
  playbookId: number;
  playbookNameEn: string | null;
}

export interface ReviewFinding {
  id: number;
  playbookClauseId: number | null;
  clauseKey: string | null;
  clauseTitle: string;
  displayOrder: number;
  extractedText: string | null;
  extractedLocation: string | null;
  aiVerdict: AiVerdict;
  aiRationale: string | null;
  aiSeverity: 'low' | 'medium' | 'high' | 'critical' | null;
  aiSuggestedRedline: string | null;
  aiConflictsWith: string[];
  userVerdict: AiVerdict | null;
  userRedline: string | null;
  userNotes: string | null;
  resolutionStatus: ResolutionStatus;
  playbookStandard?: string | null;
  playbookFallback?: string | null;
  playbookCriticality?: Criticality | null;
}

export interface ReviewDocument {
  id: number;
  documentKind: 'original_upload' | 'extracted_text' | 'redline_docx' | 'final_signed';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageUri: string;
  pageCount: number | null;
  extractionEngine: string | null;
  createdAt: string;
}

export interface ReviewDetail {
  id: number;
  referenceCode: string;
  counterpartyName: string;
  counterpartyEmail: string | null;
  agreementTitle: string;
  agreementType: string;
  status: ReviewStatus;
  overallVerdict: OverallVerdict | null;
  overallRisk: OverallRisk | null;
  riskScore: number | null;
  acceptCount: number;
  amendCount: number;
  rejectCount: number;
  conflictCount: number;
  executiveSummary: string | null;
  llmModelVersion: string | null;
  llmAnalysedAt: string | null;
  llmError: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  createdByName: string | null;
  playbook: {
    id: number;
    playbookKey: string;
    agreementType: AgreementType;
    nameEn: string;
    nameAr: string | null;
    version: number;
  } | null;
  findings: ReviewFinding[];
  documents: ReviewDocument[];
}

export interface ListReviewsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ListReviewsResponse {
  data: ReviewListItem[];
  pagination: PaginationMeta;
}

export interface UploadResponse {
  id: number;
  referenceCode: string;
  status: ReviewStatus;
  overallVerdict: OverallVerdict;
  overallRisk: OverallRisk;
  riskScore: number;
  acceptCount: number;
  amendCount: number;
  rejectCount: number;
}

export interface UpdateFindingPayload {
  userVerdict?: AiVerdict;
  userRedline?: string;
  userNotes?: string;
  resolutionStatus?: ResolutionStatus;
}

export interface SetStatusPayload {
  status: 'awaiting_review' | 'reviewed' | 'redline_sent' | 'closed_accepted' | 'closed_rejected';
  notes?: string;
}
