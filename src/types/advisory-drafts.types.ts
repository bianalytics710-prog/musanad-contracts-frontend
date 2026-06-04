/**
 * M16 / CR-H — Advisory Draft types (FE adapter).
 * Source: api-contracts.json § advisory-drafts
 */
import type { PaginationMeta } from '@/types/api.types';

export type ApprovalStatus = 'unapproved' | 'approved' | 'rejected' | 'modified';

export interface AdvisoryDraftListItem {
  id: number;
  correlationId: number;
  templateId: number;
  contractId: number | null;
  // L16 — BE now returns contractNumber; keep contractTitle for compatibility
  contractNumber: string | null;
  contractTitle: string | null;
  contractTitleEn?: string | null;
  contractTitleAr?: string | null;
  counterpartyName: string | null;
  counterpartyNameAr?: string | null;
  draftType: string;
  approvalStatus: ApprovalStatus;
  generatedAt: string;
  createdBy: number;
  createdByName: string | null;
}

export interface SourceCorrelation {
  id: number;
  ruleId: number | null;
  ruleName: string | null;
  severity: string;
  createdAt: string;
}

export interface MatchedClause {
  id: number;
  clauseType?: string | null;
  clauseTitle: string | null;
  snippet: string | null;
  pageNo?: number | null;
  summary?: string | null;
}

export interface MatchedSignal {
  id: number;
  kind: string;
  title: string | null;
}

export interface RiskScoreDimension {
  score: number | null;
  probability?: number | null;
  impact?: number | null;
  reasons?: string[] | null;
}
export interface RiskScoreSummary {
  healthScore: number | null;
  computedAt: string | null;
  marValue?: number | null;
  marCurrency?: string | null;
  dimensions?: {
    legal?: RiskScoreDimension;
    financial?: RiskScoreDimension;
    operational?: RiskScoreDimension;
    reputational?: RiskScoreDimension;
    compliance?: RiskScoreDimension;
  } | null;
  weightsAtCalculation?: {
    legal?: number;
    financial?: number;
    operational?: number;
    reputational?: number;
    compliance?: number;
  } | null;
  weightsVersion?: string | null;
}

export interface TemplateMeta {
  templateId: string;
  displayNameEn: string;
  displayNameAr: string;
  draftType: string;
  version: number;
  assignedApproverRole: string;
}

export interface AdvisoryDraft {
  id: number;
  correlationId: number;
  templateId: number;
  contractId: number | null;
  contractNumber?: string | null;
  contractTitleEn?: string | null;
  contractTitleAr?: string | null;
  counterpartyName?: string | null;
  counterpartyEmail?: string | null;
  templateVersion: number;
  approvalStatus: ApprovalStatus;
  generatedTextEn: string;
  generatedTextAr: string;
  finalTextEn: string | null;
  finalTextAr: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  dispatchedAt: string | null;
  createdBy: number;
  createdByName: string | null;
  generatedAt: string;
  sourceCorrelation: SourceCorrelation | null;
  matchedClauses: MatchedClause[];
  matchedSignal: MatchedSignal | null;
  riskScoreSummary: RiskScoreSummary | null;
  templateMeta: TemplateMeta | null;
}

export interface ListAdvisoryDraftsResponse {
  data: AdvisoryDraftListItem[];
  pagination: PaginationMeta;
}

export interface GenerateAdvisoryDraftDto {
  correlationId: number;
  templateId: number;
  contractId?: number;
}

export interface GenerateAdvisoryDraftResponse {
  draftId: number;
  correlationId: number;
  templateId: number;
  contractId: number;
  templateVersion: number;
  approvalStatus: 'unapproved';
  generatedTextEn: string;
  generatedTextAr: string;
}

export interface ApproveAdvisoryDraftDto {
  finalTextEn?: string;
  finalTextAr?: string;
}

export interface ApproveAdvisoryDraftResponse {
  id: number;
  approvalStatus: 'approved';
  approvedAt: string;
  approvedByName: string;
  finalTextEn: string;
  finalTextAr: string;
}

export interface RejectAdvisoryDraftDto {
  rejectionReason: string;
}

export interface RejectAdvisoryDraftResponse {
  id: number;
  approvalStatus: 'rejected';
  approvedAt: string;
  approvedByName: string;
  rejectionReason: string;
}

export interface ModifyAdvisoryDraftDto {
  finalTextEn: string;
  finalTextAr: string;
}

export interface ModifyAdvisoryDraftResponse {
  id: number;
  approvalStatus: 'modified';
  finalTextEn: string;
  finalTextAr: string;
}

export interface DispatchRecipient {
  email: string;
  name: string;
  userId?: number;
}

export interface DispatchAdvisoryDraftDto {
  recipients: DispatchRecipient[];
}

export interface DispatchAdvisoryDraftResponse {
  draftId: number;
  dispatchedAt: string;
  channels: string[];
  advisoryDispatchLogIds: number[];
  notificationDispatchLogIds: number[];
}

export interface AdvisoryDispatchLogItem {
  id: number;
  channel: string;
  recipientAddress: string | null;
  status: string;
  deliveryAttemptedAt: string | null;
  errorMessage: string | null;
}

export interface AdvisoryDispatchLogResponse {
  data: AdvisoryDispatchLogItem[];
}

export interface ListAdvisoryDraftsParams {
  page?: number;
  limit?: number;
  approvalStatus?: string;
  contractId?: number;
  correlationId?: number;
  draftType?: string;
  myQueue?: boolean;
}
