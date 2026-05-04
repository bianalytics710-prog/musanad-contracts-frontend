// ============================================================
// M3 — Signatures + Signer Q&A AI — Frontend TypeScript Type Definitions
// Project: Musanad Contracts Hub (musanad-contracts)
// Source of truth: .claude/workspace/current-module/types.ts (Agent 5)
//
// Mirrors BE src/types/signature.types.ts (camelCase wire shape).
// JSONB output keys are camelCase. Date/time fields are ISO-8601 strings.
//
// SENSITIVE — never log:
//   - invitationTokenPlaintext / sessionTokenPlaintext (returned ONCE)
//   - signatureData / signatureImageUrl
//   - signerEmail (full plaintext) / signerPhone
//   - userMessage (Q&A)
// ============================================================

import type { ApiResponse, Paginated, PaginationMeta } from "@/types/api.types";
import type { ContractStatus, UserRef } from "@/types/entities/contract.types";

export type { ApiResponse, Paginated, PaginationMeta, UserRef, ContractStatus };

// ------------------------------------------------------------
// 1. Cross-module ActivityType extension (AE-1) — informational
// ------------------------------------------------------------

/**
 * 6 new signature-namespace activity types added by M3.
 * The full ContractActivity.activityType union is extended in
 * `@/types/entities/contract.types` directly; this constant is exported for
 * test fixtures and audit-config wiring (matches BE M3_ACTIVITY_TYPE_EXTENSIONS).
 */
export const M3_ACTIVITY_TYPE_EXTENSIONS = [
  "sent_for_signature",
  "signer_viewed",
  "signer_signed",
  "signer_declined",
  "fully_executed",
  "signature_invalidated",
] as const;

export type M3ActivityTypeExtension = (typeof M3_ACTIVITY_TYPE_EXTENSIONS)[number];

// ------------------------------------------------------------
// 2. M3 enum unions
// ------------------------------------------------------------

export type SignerSide = "employer" | "counterparty" | "witness";

export const SIGNER_SIDE_VALUES: readonly SignerSide[] = [
  "employer",
  "counterparty",
  "witness",
];

export type SignatureMethod = "uae_pass" | "ds_otp" | "drawn" | "typed";

export const SIGNATURE_METHOD_VALUES: readonly SignatureMethod[] = [
  "uae_pass",
  "ds_otp",
  "drawn",
  "typed",
];

export type UaePassVerificationLevel = "basic" | "verified" | "premium";

export type SignatureInvitationStatus =
  | "pending"
  | "viewed"
  | "signed"
  | "declined"
  | "expired"
  | "cancelled";

export type SignatureEventType =
  | "viewed"
  | "signed"
  | "declined"
  | "expired"
  | "cancelled"
  | "resent";

export type SignatureLanguage = "en" | "ar";

export type SignerQaRecordMessageMode = "GATE" | "COMMIT";

// ------------------------------------------------------------
// 3. M3 permissions
// ------------------------------------------------------------

export const M3_NEW_PERMISSIONS = [
  "signature.send",
  "signature.cancel",
  "signature.read.all",
] as const;

export type M3PermissionCode = (typeof M3_NEW_PERMISSIONS)[number];

// ------------------------------------------------------------
// 4. signature_method ref / lookup
// ------------------------------------------------------------

export interface SignatureMethodRef {
  code: SignatureMethod;
  labelEn: string;
  labelAr: string;
  /** 1=lowest (typed), 4=highest (uae_pass). */
  verificationStrength: 1 | 2 | 3 | 4;
  isEnabled: boolean;
  isActive: boolean;
}

// ------------------------------------------------------------
// 5. signature_party — owned entity (S1 + S6)
// ------------------------------------------------------------

/**
 * S1 — Per-signer row submitted in the bulk-create payload.
 * Maps to fn_signature_party_create_bulk p_signers[i].
 */
export interface SignaturePartyInput {
  signerSide: SignerSide;
  signerUserId?: number | null;
  signerNameEn: string;
  signerNameAr?: string | null;
  /** SENSITIVE — never echoed to logs. */
  signerEmail?: string | null;
  /** SENSITIVE — never returned in any response. */
  signerPhone?: string | null;
  signerPartyId?: number | null;
  stepOrder: number;
  isRequired?: boolean;
}

/**
 * SignatureParty — projected from fn_signature_list_for_contract.
 * signerEmail is masked for non-privileged roles (AC-S6-04); never plaintext on
 * PUBLIC paths. signerPhone is NEVER projected.
 */
export interface SignatureParty {
  id: number;
  signerSide: SignerSide;
  signerNameEn: string;
  signerNameAr: string | null;
  signerEmail: string | null;
  stepOrder: number;
  isRequired: boolean;
  /**
   * Active signature_invitation row id for this party, or null when no
   * invitation has been issued yet (or it was rolled back to inactive).
   * Added by migration 038. Used by ContractSignaturesTab Cancel button to
   * call POST /signature-invitations/:id/cancel with the right id.
   */
  currentInvitationId: number | null;
  currentInvitationStatus: SignatureInvitationStatus | null;
  invitationSentAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  lastEventType: SignatureEventType | null;
  signatureMethod: SignatureMethod | null;
  uaePassVerificationLevel: UaePassVerificationLevel | null;
}

// ------------------------------------------------------------
// 6. signature_invitation projections
// ------------------------------------------------------------

export interface SignatureSendInvitationItem {
  signaturePartyId: number;
  /** @once-only — never persisted by FE; returned by API exactly once on creation. */
  invitationTokenPlaintext: string;
  expiresAt: string;
  /** Plaintext (used for display in copy-link UX); never stored long-term. */
  signerEmail: string | null;
}

/**
 * Public landing-page payload returned by GET /api/v1/sign/:invitationToken (S3).
 * Email always masked. signerPhone never returned.
 */
export interface SignaturePublicView {
  invitation: {
    id: number;
    status: SignatureInvitationStatus;
    expiresAt: string;
    viewCount: number;
    language: SignatureLanguage;
  };
  signer: {
    side: SignerSide;
    nameEn: string;
    nameAr: string | null;
    /** Masked form ONLY (e.g., 'j***@example.com'). */
    email: string | null;
  };
  contract: {
    id: number;
    contractNumber: string;
    titleEn: string;
    titleAr: string | null;
    contractType: string;
    valueAed: number | null;
    startDate: string | null;
    endDate: string | null;
    ourPartyName: string | null;
    counterpartyName: string | null;
    aiSummaryEn: string | null;
    aiSummaryAr: string | null;
    /** TRUNCATED to 4000 chars on the BE. */
    bodyEnExcerpt: string | null;
    bodyArExcerpt: string | null;
  };
  availableMethods: SignatureMethodRef[];
}

// ------------------------------------------------------------
// 7. fn_signature_party_create_bulk — DTO + response (S1)
// ------------------------------------------------------------

export interface SignaturePartyCreateBulkDto {
  signers: SignaturePartyInput[];
}

export interface SignaturePartyCreateBulkData {
  signatureParties: SignatureParty[];
  createdCount: number;
  skippedCount: number;
}

export type SignaturePartyCreateBulkResponse = ApiResponse<SignaturePartyCreateBulkData>;

// ------------------------------------------------------------
// 8. fn_signature_send_for_signature — request + response (S2)
// ------------------------------------------------------------

/** S2 — POST has empty body; controller derives all params. */
export type SendForSignatureDto = Record<string, never>;

export interface SendForSignatureData {
  contractId: number;
  /** Always 'awaiting_signature_employer' on success. */
  newStatus: ContractStatus;
  invitations: SignatureSendInvitationItem[];
}

export type SendForSignatureResponse = ApiResponse<SendForSignatureData>;

// ------------------------------------------------------------
// 9. fn_signature_invitation_resend — DTO + response (S7)
// ------------------------------------------------------------

export interface ResendInvitationDto {
  reason?: string;
}

export interface ResendInvitationData {
  newInvitationId: number;
  /** @once-only — never persisted. */
  invitationTokenPlaintext: string;
  expiresAt: string;
}

export type ResendInvitationResponse = ApiResponse<ResendInvitationData>;

// ------------------------------------------------------------
// 10. fn_signature_invitation_cancel — DTO + response (S8)
// ------------------------------------------------------------

export interface CancelInvitationDto {
  reason: string;
}

export interface CancelInvitationData {
  invitationId: number;
  status: SignatureInvitationStatus;
  contractRolledBack: boolean;
}

export type CancelInvitationResponse = ApiResponse<CancelInvitationData>;

// ------------------------------------------------------------
// 11. fn_signature_get_by_invitation_token — response (S3)
// ------------------------------------------------------------

export type SignaturePublicViewResponse = ApiResponse<SignaturePublicView>;

// ------------------------------------------------------------
// 12. fn_signature_sign — DTO + response (S4)
// ------------------------------------------------------------

export interface SignContractDto {
  signatureMethod: SignatureMethod;
  /** SENSITIVE. Required for typed/drawn (>= 2 chars trimmed). */
  signatureData?: string | null;
  /** SENSITIVE. Required for drawn. */
  signatureImageUrl?: string | null;
  uaePassVerificationLevel?: UaePassVerificationLevel | null;
  metadata?: Record<string, unknown> | null;
}

export interface RemainingSignerSummary {
  signaturePartyId: number;
  signerSide: SignerSide;
  status: SignatureInvitationStatus;
}

export interface SignContractData {
  invitationId: number;
  status: SignatureInvitationStatus;
  signedAt: string;
  stepCompleted: boolean;
  contractNewStatus: ContractStatus | null;
  remainingSigners: RemainingSignerSummary[];
}

export type SignContractResponse = ApiResponse<SignContractData>;

// ------------------------------------------------------------
// 13. fn_signature_decline — DTO + response (S5)
// ------------------------------------------------------------

export interface DeclineContractDto {
  declineReason: string;
}

export interface DeclineContractData {
  invitationId: number;
  status: SignatureInvitationStatus;
  contractNewStatus: ContractStatus | null;
}

export type DeclineContractResponse = ApiResponse<DeclineContractData>;

// ------------------------------------------------------------
// 14. fn_signature_list_for_contract — response (S6)
// ------------------------------------------------------------

export interface SignatureStepProgress {
  stepOrder: number;
  totalRequired: number;
  signedCount: number;
  declinedCount: number;
  pendingCount: number;
}

export interface SignatureListData {
  contractId: number;
  currentStatus: ContractStatus;
  signers: SignatureParty[];
  stepProgress: SignatureStepProgress[];
}

export type SignatureListResponse = ApiResponse<SignatureListData>;

// ------------------------------------------------------------
// 15. signer_qa_session_start — DTO + response (S11)
// ------------------------------------------------------------

export interface SignerQaSessionStartDto {
  language?: SignatureLanguage;
}

export interface SignerQaRateLimitMeta {
  maxMessagesPerHour: number;
  remaining: number;
}

export interface SignerQaSessionStartData {
  /** @once-only — held only in component state for the open drawer. */
  sessionTokenPlaintext: string;
  sessionId: number;
  rateLimit: SignerQaRateLimitMeta;
  language: SignatureLanguage;
}

export type SignerQaSessionStartResponse = ApiResponse<SignerQaSessionStartData>;

// ------------------------------------------------------------
// 16. signer_qa_session_record_message — DTO + SSE chunks (S12)
// ------------------------------------------------------------

export interface SignerQaRecordMessageDto {
  mode: SignerQaRecordMessageMode;
  tokensConsumed: number;
  /** SENSITIVE. Required in GATE mode; rejected in COMMIT mode. */
  userMessage?: string | null;
}

/**
 * SSE chunk shape from POST /api/v1/sign/:invitationToken/qa/message.
 * Wire format per chunk: `data: <JSON>\n\n`.
 */
export type SignerQaMessageStreamChunk =
  | { type: "token"; delta: string }
  | { type: "done"; tokensConsumed: number }
  | {
      type: "error";
      code: string;
      message?: string;
      retryAfterSeconds?: number;
    };

// ------------------------------------------------------------
// 17. Path-param shapes
// ------------------------------------------------------------

export interface SignaturePartyIdParam {
  id: string;
}

export interface SignatureInvitationIdParam {
  id: string;
}

export interface InvitationTokenParam {
  invitationToken: string;
}
