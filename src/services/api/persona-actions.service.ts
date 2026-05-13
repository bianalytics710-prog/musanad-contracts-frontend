/**
 * Unit-3 — Persona action routes for Operations / Finance & Treasury / Compliance & ESG.
 *
 * All routes:
 *   - Require JWT (handled by apiClient interceptor).
 *   - Gated by `risk.acknowledge` permission (enforced on BE).
 *   - Return envelope { data: T } — unwrapped here.
 *
 * Named action types match unit3-api-contracts.md §§ Ops / Finance / Compliance.
 */

import { apiClient, unwrap } from "@/lib/api-client";

const BASE = "/api/v1";

// ─── Ops ─────────────────────────────────────────────────────────────────────

export interface AcknowledgeEventInput {
  note?: string;
}

export interface AcknowledgeEventResult {
  correlationId: string;
  acknowledgedAt: string;
}

export interface LinkRemedyInput {
  contractId: string;
  clauseId?: string;
  note?: string;
}

export interface LinkRemedyResult {
  correlationId: string;
  contractId: string;
  linkedAt: string;
}

export interface EscalateEventInput {
  toRole: "procurement" | "legal" | "executive";
  note?: string;
}

export interface EscalateEventResult {
  correlationId: string;
  escalatedTo: string;
  escalatedAt: string;
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export interface InitiatePriceReviewInput {
  correlationId: string;
  reason: "index_crossed" | "escalation" | "manual";
  note?: string;
}

export interface InitiatePriceReviewResult {
  contractId: string;
  correlationId: string;
  initiatedAt: string;
}

export interface RecommendPaymentHoldInput {
  invoiceRef?: string;
  amountAed?: number;
  note?: string;
}

export interface RecommendPaymentHoldResult {
  contractId: string;
  recommendedAt: string;
}

export interface InitiateHedgeReviewInput {
  pair?: string;
  exposureAed?: number;
  note?: string;
}

export interface InitiateHedgeReviewResult {
  contractId: string;
  initiatedAt: string;
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export interface RaiseFlagInput {
  flagKind: "sanctions" | "esg" | "audit_rights" | "other";
  severity: "low" | "medium" | "high" | "critical";
  note?: string;
}

export interface RaiseFlagResult {
  contractId: string;
  flagId: string;
  raisedAt: string;
}

export interface InitiateSupplierAuditInput {
  scope: "financial" | "operational" | "esg" | "sanctions" | "full";
  targetDate?: string;
  note?: string;
}

export interface InitiateSupplierAuditResult {
  contractId: string;
  initiatedAt: string;
}

export interface RecommendHoldInput {
  reason: string;
  proposedHoldUntil?: string;
}

export interface RecommendHoldResult {
  contractId: string;
  recommendedAt: string;
}

export interface RecommendTerminationInput {
  reason: string;
  grounds:
    | "sanctions"
    | "material_breach"
    | "esg_violation"
    | "non_performance"
    | "regulatory_compliance"
    | "other";
}

export interface RecommendTerminationResult {
  contractId: string;
  recommendedAt: string;
}

// ─── Audit rights ─────────────────────────────────────────────────────────────

export interface AuditRightsClause {
  clauseId: string;
  clauseType: string;
  parameters: {
    startDate?: string;
    endDate?: string;
    scope?: string;
    frequency?: string;
  };
  pageNo: number | null;
  confidence: number;
  summaryEn: string;
  summaryAr: string;
  reviewStatus: string;
  extractedAt: string;
  daysToExpiry: number | null;
  severity: string;
}

export interface AuditRightsDrilldownResult {
  contractId: string;
  auditRightsClauses: AuditRightsClause[];
  count: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const personaActionsService = {
  // Ops
  acknowledgeEvent: async (
    correlationId: string,
    input: AcknowledgeEventInput,
  ): Promise<AcknowledgeEventResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: AcknowledgeEventResult }>(
      `${BASE}/ops/events/${correlationId}/acknowledge`,
      input,
    );
    return unwrap<AcknowledgeEventResult>(data);
  },

  linkRemedy: async (
    correlationId: string,
    input: LinkRemedyInput,
  ): Promise<LinkRemedyResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: LinkRemedyResult }>(
      `${BASE}/ops/events/${correlationId}/link-remedy`,
      input,
    );
    return unwrap<LinkRemedyResult>(data);
  },

  escalateEvent: async (
    correlationId: string,
    input: EscalateEventInput,
  ): Promise<EscalateEventResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: EscalateEventResult }>(
      `${BASE}/ops/events/${correlationId}/escalate`,
      input,
    );
    return unwrap<EscalateEventResult>(data);
  },

  // Finance
  initiatePriceReview: async (
    contractId: string,
    input: InitiatePriceReviewInput,
  ): Promise<InitiatePriceReviewResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: InitiatePriceReviewResult }>(
      `${BASE}/finance/contracts/${contractId}/price-review`,
      input,
    );
    return unwrap<InitiatePriceReviewResult>(data);
  },

  recommendPaymentHold: async (
    contractId: string,
    input: RecommendPaymentHoldInput,
  ): Promise<RecommendPaymentHoldResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: RecommendPaymentHoldResult }>(
      `${BASE}/finance/contracts/${contractId}/payment-hold`,
      input,
    );
    return unwrap<RecommendPaymentHoldResult>(data);
  },

  initiateHedgeReview: async (
    contractId: string,
    input: InitiateHedgeReviewInput,
  ): Promise<InitiateHedgeReviewResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: InitiateHedgeReviewResult }>(
      `${BASE}/finance/contracts/${contractId}/hedge-review`,
      input,
    );
    return unwrap<InitiateHedgeReviewResult>(data);
  },

  // Compliance
  raiseFlag: async (
    contractId: string,
    input: RaiseFlagInput,
  ): Promise<RaiseFlagResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: RaiseFlagResult }>(
      `${BASE}/compliance/contracts/${contractId}/raise-flag`,
      input,
    );
    return unwrap<RaiseFlagResult>(data);
  },

  initiateSupplierAudit: async (
    contractId: string,
    input: InitiateSupplierAuditInput,
  ): Promise<InitiateSupplierAuditResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: InitiateSupplierAuditResult }>(
      `${BASE}/compliance/contracts/${contractId}/supplier-audit`,
      input,
    );
    return unwrap<InitiateSupplierAuditResult>(data);
  },

  recommendHold: async (
    contractId: string,
    input: RecommendHoldInput,
  ): Promise<RecommendHoldResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: RecommendHoldResult }>(
      `${BASE}/compliance/contracts/${contractId}/recommend-hold`,
      input,
    );
    return unwrap<RecommendHoldResult>(data);
  },

  recommendTermination: async (
    contractId: string,
    input: RecommendTerminationInput,
  ): Promise<RecommendTerminationResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: RecommendTerminationResult }>(
      `${BASE}/compliance/contracts/${contractId}/recommend-termination`,
      input,
    );
    return unwrap<RecommendTerminationResult>(data);
  },

  // Audit rights drilldown (GET — placed here for co-location)
  getAuditRights: async (contractId: string): Promise<AuditRightsDrilldownResult> => {
    const { data } = await apiClient.get<{ success: boolean; data: AuditRightsDrilldownResult }>(
      `${BASE}/contracts/${contractId}/audit-rights`,
    );
    return unwrap<AuditRightsDrilldownResult>(data);
  },

  // ICV certificate multipart upload (R-CES H3). Returns the new attachment.
  uploadIcvCertificate: async (
    contractId: string,
    file: File,
    validUntil?: string,
  ): Promise<IcvCertificateUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (validUntil) formData.append('validUntil', validUntil);
    const { data } = await apiClient.post<{ success: boolean; data: IcvCertificateUploadResult }>(
      `/api/v1/compliance/contracts/${contractId}/icv-certificate`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return unwrap<IcvCertificateUploadResult>(data);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Unit-4 / R-PROC — Procurement persona actions
  // ──────────────────────────────────────────────────────────────────────────

  activateAlternateVendor: async (
    partyId: string,
    input: ActivateAlternateInput,
  ): Promise<ActivateAlternateResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: ActivateAlternateResult }>(
      `${BASE}/procurement/vendors/${partyId}/activate-alternate`,
      input,
    );
    return unwrap<ActivateAlternateResult>(data);
  },

  escalateVendorPerformance: async (
    partyId: string,
    input: EscalateVendorInput,
  ): Promise<EscalateVendorResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: EscalateVendorResult }>(
      `${BASE}/procurement/vendors/${partyId}/escalate`,
      input,
    );
    return unwrap<EscalateVendorResult>(data);
  },

  recordCureNoticeIntent: async (
    contractId: string,
    input: CureNoticeIntentInput,
  ): Promise<CureNoticeIntentResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: CureNoticeIntentResult }>(
      `${BASE}/procurement/contracts/${contractId}/cure-notice-intent`,
      input,
    );
    return unwrap<CureNoticeIntentResult>(data);
  },

  initiateIcvRemediation: async (
    contractId: string,
    input: IcvRemediationInput,
  ): Promise<IcvRemediationResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: IcvRemediationResult }>(
      `${BASE}/procurement/contracts/${contractId}/icv-remediation`,
      input,
    );
    return unwrap<IcvRemediationResult>(data);
  },
};

export interface IcvCertificateUploadResult {
  attachmentId: string;
  contractId: string;
  kind: 'icv_certificate';
  validUntil?: string;
}

export interface ActivateAlternateInput {
  alternatePartyId?: number;
  alternateVendorName?: string;
  forContractId?: number;
  note?: string;
}
export interface ActivateAlternateResult {
  partyId: string;
  activatedAt: string;
}

export interface EscalateVendorInput {
  reason: string;
  toRole?: 'legal' | 'executive' | 'compliance' | 'finance_treasury';
}
export interface EscalateVendorResult {
  partyId: string;
  escalatedAt: string;
  escalatedTo: string | null;
}

export interface CureNoticeIntentInput {
  breachDescription: string;
  curePeriodDays?: number;
  note?: string;
}
export interface CureNoticeIntentResult {
  contractId: string;
  recordedAt: string;
  note?: string;
}

export interface IcvRemediationInput {
  shortfallDescription: string;
  proposedRemediationSteps?: string;
  forwardToCompliance?: boolean;
}
export interface IcvRemediationResult {
  contractId: string;
  initiatedAt: string;
  forwardedToCompliance: boolean;
}
