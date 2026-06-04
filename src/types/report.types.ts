/**
 * Unit 7 (M20 — CR-L Reports & Briefings) — TypeScript Type Definitions.
 *
 * Derived from `.claude/workspace/current-module/types.ts` (Agent 5 output,
 * 2026-05-15). Imports from the FE-local @/types/api.types barrel.
 */

import type { PaginationMeta as _PaginationMeta } from '@/types/api.types';
import type { ContentSensitivity } from './risk-case.types';

// PaginationMeta isn't used by report endpoints (template list is bounded);
// re-exporting it here would invite mis-use. Cast as void to satisfy lint
// while keeping the import path correct for forward-compat changes.
const _META_PROBE: _PaginationMeta | null = null;
void _META_PROBE;

// ============================================================
// Unions
// ============================================================

export type ReportKind = 'excel' | 'pdf' | 'both';
export type ReportRunFormat = 'excel' | 'pdf';
export type ReportRunTriggeredBy = 'manual' | 'scheduled';
export type ReportRunStatus = 'pending' | 'generating' | 'complete' | 'failed';

// ============================================================
// Templates
// ============================================================

/**
 * Canonical parameter-schema sub-shape used by the FE GenerateReportDialog.
 * Templates may extend with extra keys; basic UI renders dateRange +
 * statusFilter (HITL Q5=basic).
 */
export interface ReportParameterSchema {
  dateRange?: {
    start: string;
    end: string;
  };
  statusFilter?: string;
  [key: string]: unknown;
}

export interface ReportTemplate {
  id: number;
  tenantId: string;
  templateId: string;
  displayNameEn: string;
  displayNameAr: string | null;
  description: string | null;
  reportKind: ReportKind;
  dataSource: string;
  parameterSchema: ReportParameterSchema;
  assignedRoles: string[];
  isScheduled: boolean;
  scheduleCron: string | null;
  scheduleRecipients: string[] | null;
  lastRunAt: string | null;
  enabled: boolean;
  dataClassification: ContentSensitivity;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
  isActive: boolean;
}

export interface ReportTemplateUserListItem {
  id: number;
  templateId: string;
  displayNameEn: string;
  displayNameAr: string | null;
  description: string | null;
  reportKind: ReportKind;
  parameterSchema: ReportParameterSchema;
  assignedRoles: string[];
  /** FE Reports library groups cards under section headers. NULL = ungrouped. */
  sectionKey: string | null;
  lastRunAt: string | null;
}

export interface ReportTemplateAdminListItem extends ReportTemplateUserListItem {
  isScheduled: boolean;
  scheduleCron: string | null;
  scheduleRecipients: string[] | null;
  enabled: boolean;
  /** Admin-mode list includes dataSource for the admin grid view. */
  dataSource: string;
}

export interface ReportTemplateUserListResponse {
  data: ReportTemplateUserListItem[];
}

export interface ReportTemplateAdminListResponse {
  data: ReportTemplateAdminListItem[];
}

export interface CreateReportTemplateDto {
  templateId: string;
  displayNameEn: string;
  displayNameAr?: string | null;
  description?: string | null;
  reportKind: ReportKind;
  dataSource: string;
  parameterSchema?: ReportParameterSchema;
  assignedRoles: string[];
  isScheduled?: boolean;
  scheduleCron?: string | null;
  scheduleRecipients?: string[] | null;
}

export interface UpdateReportTemplateDto {
  displayNameEn?: string;
  displayNameAr?: string | null;
  description?: string | null;
  dataSource?: string;
  parameterSchema?: ReportParameterSchema;
  assignedRoles?: string[];
  isScheduled?: boolean;
  scheduleCron?: string | null;
  scheduleRecipients?: string[] | null;
  enabled?: boolean;
}

export interface DeleteReportTemplateResponse {
  deletedId: number;
  success: true;
}

// ============================================================
// Runs
// ============================================================

export interface ReportRun {
  id: number;
  tenantId: string;
  reportTemplateId: number;
  triggeredBy: ReportRunTriggeredBy;
  triggeredByUserId: number | null;
  parameters: ReportParameterSchema;
  format: ReportRunFormat;
  outputUri: string | null;
  outputSizeBytes: number | null;
  status: ReportRunStatus;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface TriggerReportRunDto {
  triggeredBy?: ReportRunTriggeredBy;
  parameters?: ReportParameterSchema;
  format: ReportRunFormat;
}

export interface TriggerReportRunResponse {
  runId: number;
  // After the sync-render refactor the response is 'complete' (or 'failed').
  // 'pending' is kept for backward-compatibility with any legacy callers.
  status: 'complete' | 'failed' | 'pending';
  format?: ReportRunFormat;
  outputSizeBytes?: number | null;
  signedUrl?: string | null;
  signedUrlExpiresAt?: string | null;
  fileName?: string;
  error?: string;
}

export interface ReportRunDetail {
  runId: number;
  status: ReportRunStatus;
  format: ReportRunFormat;
  startedAt: string | null;
  completedAt: string | null;
  outputSizeBytes: number | null;
  errorMessage: string | null;
  outputUri: string | null;
  /** Signed download URL — only present when status='complete' and caller is authorised. */
  signedUrl?: string;
  signedUrlExpiresAt?: string;
}

// ============================================================
// Data-source slug union — drives template editor select options
// ============================================================

export type ReportDataSourceSlug =
  | 'executive_weekly_brief'
  | 'executive_monthly_board'
  | 'executive_avar_trend'
  | 'executive_top10_exposures'
  | 'legal_advisory_queue'
  | 'legal_clause_review_backlog'
  | 'legal_fm_eligibility'
  | 'legal_regulatory_digest'
  | 'procurement_supplier_scorecard'
  | 'procurement_supplier_scorecard_detail'
  | 'procurement_icv_compliance'
  | 'procurement_sla_breach'
  | 'operations_risk_board_snapshot'
  | 'operations_delivery_delay'
  | 'operations_penalty_exposure'
  | 'finance_fx_exposure'
  | 'finance_price_review_queue'
  | 'finance_payment_delay'
  | 'compliance_sanctions_exposure'
  | 'compliance_subcontractor_chain'
  | 'compliance_audit_rights'
  | 'admin_system_health'
  | 'admin_audit_chain_verification'
  | 'admin_source_health_snapshot';

export const REPORT_DATA_SOURCE_SLUGS: ReportDataSourceSlug[] = [
  'executive_weekly_brief',
  'executive_monthly_board',
  'executive_avar_trend',
  'executive_top10_exposures',
  'legal_advisory_queue',
  'legal_clause_review_backlog',
  'legal_fm_eligibility',
  'legal_regulatory_digest',
  'procurement_supplier_scorecard',
  'procurement_supplier_scorecard_detail',
  'procurement_icv_compliance',
  'procurement_sla_breach',
  'operations_risk_board_snapshot',
  'operations_delivery_delay',
  'operations_penalty_exposure',
  'finance_fx_exposure',
  'finance_price_review_queue',
  'finance_payment_delay',
  'compliance_sanctions_exposure',
  'compliance_subcontractor_chain',
  'compliance_audit_rights',
  'admin_system_health',
  'admin_audit_chain_verification',
  'admin_source_health_snapshot',
];

export const REPORT_KINDS: ReportKind[] = ['excel', 'pdf', 'both'];
export const REPORT_RUN_FORMATS: ReportRunFormat[] = ['excel', 'pdf'];
export const REPORT_RUN_STATUSES: ReportRunStatus[] = [
  'pending',
  'generating',
  'complete',
  'failed',
];
