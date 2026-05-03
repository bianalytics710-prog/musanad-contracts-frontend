// ============================================================
// M1b — Payment Schedule + Compose Wizard + Exports — TS Types
// Project: Musanad Contracts Hub (musanad-contracts)
// Source of truth: .claude/workspace/current-module/types.ts (Agent 5)
//
// Mirrors the JSONB camelCase output of fn_payment_schedule_list /
// fn_payment_schedule_create_bulk / fn_contract_export_pdf /
// fn_contract_export_xlsx. M1b introduces no new sensitive fields —
// body_en/body_ar inherit M1a redaction.
// ============================================================

import type {
  ContractLanguage,
  GoverningLaw,
  RelationshipType,
} from "@/types/entities/contract.types";

// ------------------------------------------------------------
// 1. Activity-type extension (M1a 7 + M1b 2 = 9 values)
// ------------------------------------------------------------

export const M1B_ACTIVITY_TYPE_EXTENSIONS = ["payment_schedule_replaced", "exported"] as const;

export type M1bActivityTypeExtension = (typeof M1B_ACTIVITY_TYPE_EXTENSIONS)[number];

// ------------------------------------------------------------
// 2. PaymentScheduleStatus + Recurrence enums (DB CHECK)
// ------------------------------------------------------------

export type PaymentScheduleStatus = "pending" | "due" | "paid" | "overdue" | "waived" | "cancelled";

export const PAYMENT_SCHEDULE_STATUS_VALUES: readonly PaymentScheduleStatus[] = [
  "pending",
  "due",
  "paid",
  "overdue",
  "waived",
  "cancelled",
];

export type PaymentScheduleRecurrence = "once" | "monthly" | "quarterly" | "annually";

export const PAYMENT_SCHEDULE_RECURRENCE_VALUES: readonly PaymentScheduleRecurrence[] = [
  "once",
  "monthly",
  "quarterly",
  "annually",
];

// ------------------------------------------------------------
// 3. PaymentSchedule entity
// ------------------------------------------------------------

export interface PaymentSchedule {
  id: number;
  contractId: number;
  milestoneLabelEn: string;
  milestoneLabelAr: string | null;
  milestoneNameEn: string | null;
  milestoneNameAr: string | null;
  amountAed: number;
  dueDate: string | null;
  paidAt: string | null;
  status: PaymentScheduleStatus;
  recurrence: PaymentScheduleRecurrence | null;
  invoiceRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PaymentScheduleListItem = PaymentSchedule;

// ------------------------------------------------------------
// 4. DTOs (PUT /contracts/:id/payment-schedules)
// ------------------------------------------------------------

export interface PaymentScheduleCreateDto {
  milestoneLabelEn: string;
  milestoneLabelAr?: string | null;
  milestoneNameEn?: string | null;
  milestoneNameAr?: string | null;
  amountAed: number;
  dueDate?: string | null;
  paidAt?: string | null;
  status?: PaymentScheduleStatus;
  recurrence?: PaymentScheduleRecurrence | null;
  invoiceRef?: string | null;
}

export interface PaymentScheduleBulkReplaceDto {
  rows: PaymentScheduleCreateDto[];
  replaceExisting?: boolean;
}

export interface PaymentScheduleListQuery {
  status?: PaymentScheduleStatus;
}

// ------------------------------------------------------------
// 5. Response shapes
// ------------------------------------------------------------

export interface PaymentScheduleListResponse {
  data: PaymentSchedule[];
}

export interface PaymentScheduleBulkReplaceResponse {
  contractId: number;
  inserted: number;
  softDeleted: number;
  rows: PaymentSchedule[];
}

// ------------------------------------------------------------
// 6. PDF export — request (no FE response: BE pipes binary)
// ------------------------------------------------------------

export interface ContractExportPdfQuery {
  language?: ContractLanguage;
  includeAttachments?: boolean;
}

// ------------------------------------------------------------
// 7. XLSX export — request (no FE response: BE pipes binary)
// ------------------------------------------------------------

export interface ContractExportXlsxQueryParams {
  status?: string;
  contractType?: string;
  counterpartyId?: number;
  draftedBy?: number;
  approvedBy?: number;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  tags?: string[];
  search?: string;
  /** Default 10000 server-side, hard-clamped 1..50000. */
  maxRows?: number;
}

// ------------------------------------------------------------
// 8. Compose-wizard state (FE-only orchestration types)
// ------------------------------------------------------------

export interface ComposeWizardStep1Type {
  contractType: string;
  language: ContractLanguage;
  /** Free-text — NOT persisted as our_party_id (TODO[parties-module]). */
  ourPartyName?: string | null;
  /** Free-text — NOT persisted as counterparty_id (TODO[parties-module]). */
  counterpartyName?: string | null;
  /** TODO[templates-module] — disabled picker, always null in M1b. */
  templateId?: number | null;
}

export interface ComposeWizardStep2Parties {
  titleEn: string;
  titleAr?: string | null;
  valueAed?: number | null;
  currency?: string;
  startDate?: string | null;
  endDate?: string | null;
  expiryNoticeDays?: number;
  emirate?: string | null;
  governingLaw?: GoverningLaw | null;
  jurisdictionCourt?: string | null;
  parentContractId?: number | null;
  relationshipType?: RelationshipType | null;
  paymentSchedule: PaymentScheduleCreateDto[];
}

export interface ComposeWizardStep3ClausesBody {
  /** SENSITIVE — cleared on wizard unmount per T13. */
  bodyEn?: string | null;
  /** SENSITIVE — cleared on wizard unmount per T13. */
  bodyAr?: string | null;
}

/** Step 4 (attachments) is SKIPPED in M1b — type reserved for Attachments module. */
export interface ComposeWizardStep4Attachments {
  _deferred?: true;
}

/** Step indices — 1, 2, 3, 5 (Step 4 is skipped per AC-S1-01). */
export type ComposeWizardStep = 1 | 2 | 3 | 5;

export interface ComposeWizardState {
  step1: ComposeWizardStep1Type;
  step2: ComposeWizardStep2Parties;
  step3: ComposeWizardStep3ClausesBody;
  step4?: ComposeWizardStep4Attachments;
  currentStep: ComposeWizardStep;
  /** Per-user multi-draft keying — AC-S1-07. */
  composeDraftId: string;
}
