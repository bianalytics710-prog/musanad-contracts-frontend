/**
 * Musanad — Signatures API service (M3).
 *
 * Thin axios wrappers over the M3 endpoints. Paths derived directly from
 * .claude/workspace/current-module/api-contracts.json.
 *
 * AUTH-AWARE WRAPPER:
 *   - The /api/v1/sign/* namespace is verify_jwt=false (token-bearer public).
 *     We must NOT attach the internal user's `Authorization: Bearer <jwt>`
 *     header to those requests — leaking the internal token to a public
 *     endpoint is a defense-in-depth concern. The authed apiClient interceptor
 *     attaches Authorization unconditionally; we override per request via the
 *     `transformRequest`/header replacement here.
 *
 *   - We achieve the bypass by issuing public-namespace requests with a
 *     header that explicitly clears Authorization. Axios merges per-request
 *     headers over instance headers; setting `Authorization: ""` to undefined
 *     on the config object prevents the interceptor's `set("Authorization",
 *     ...)` from being effective if we strip it after — instead we use a
 *     dedicated `apiPublicClient` axios instance with no auth interceptor.
 *
 *   - To avoid duplicating the response/error interceptor chain, we keep a
 *     SECOND axios instance just for /sign/* and /qa/*. It shares baseURL +
 *     timeout + X-Request-ID generation but does NOT attach auth.
 *
 * Endpoints owned by this service:
 *   - POST /api/v1/contracts/:id/signature-parties              (S1)
 *   - POST /api/v1/contracts/:id/send-for-signature             (S2)
 *   - GET  /api/v1/contracts/:id/signatures                     (S6)
 *   - POST /api/v1/signature-parties/:id/resend                 (S7)
 *   - POST /api/v1/signature-invitations/:id/cancel             (S8)
 *   - GET  /api/v1/sign/:invitationToken                        (S3) [PUBLIC]
 *   - POST /api/v1/sign/:invitationToken/sign                   (S4) [PUBLIC]
 *   - POST /api/v1/sign/:invitationToken/decline                (S5) [PUBLIC]
 *   - POST /api/v1/sign/:invitationToken/qa/session             (S11) [PUBLIC]
 *
 * SSE endpoint POST /qa/message is NOT implemented here — see
 * `useSignerQaSseStream` for the streaming `fetch` + ReadableStream
 * implementation (EventSource cannot send custom headers natively, and we
 * need both POST + the X-Session-Token header).
 *
 * SENSITIVE — never console.log:
 *   - Path :invitationToken / :sessionToken values
 *   - Response body's invitationTokenPlaintext / sessionTokenPlaintext
 *   - Request body signatureData / signatureImageUrl / userMessage
 *   - Path/body signerEmail (full plaintext is forwarded to BE for the
 *     mailer, never persisted client-side beyond mailer-handoff UX).
 */

import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { apiClient, ApiError } from "@/lib/api-client";
import type {
  CancelInvitationDto,
  CancelInvitationResponse,
  DeclineContractDto,
  DeclineContractResponse,
  ResendInvitationDto,
  ResendInvitationResponse,
  SendForSignatureResponse,
  SignaturePartyCreateBulkDto,
  SignaturePartyCreateBulkResponse,
  SignContractDto,
  SignContractResponse,
  SignaturePublicViewResponse,
  SignatureListResponse,
  SignerQaSessionStartDto,
  SignerQaSessionStartResponse,
} from "@/types/entities/signature.types";
import type { ErrorResponse } from "@/types/api.types";

// ─── Public axios instance ────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "http://localhost:4000";

function getBaseUrl(): string {
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return env && env.trim() !== "" ? env : DEFAULT_BASE_URL;
}

const REQUEST_TIMEOUT_MS = 30_000;

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function isErrorResponseBody(value: unknown): value is ErrorResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.success === false && typeof v.error === "object" && v.error !== null;
}

function normalisePublicAxiosError(err: AxiosError): ApiError {
  const status = err.response?.status ?? 0;
  const requestId =
    (err.response?.headers as Record<string, string | undefined> | undefined)?.[
      "x-request-id"
    ];
  const body = err.response?.data;

  if (isErrorResponseBody(body)) {
    return new ApiError({
      status,
      code: body.error.code,
      message: body.error.message,
      details: body.error.details ?? null,
      requestId: body.requestId ?? requestId,
    });
  }

  if (err.code === "ECONNABORTED") {
    return new ApiError({
      status: 0,
      code: "TIMEOUT",
      message: "The request took too long to complete.",
    });
  }

  if (!err.response) {
    return new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Unable to reach the server. Check your connection.",
    });
  }

  return new ApiError({
    status,
    code: status >= 500 ? "SERVER_ERROR" : "HTTP_ERROR",
    message: err.message || `Request failed with status ${status}.`,
    requestId,
  });
}

/**
 * Public axios instance for the verify_jwt=false /sign/* namespace.
 *
 * - No Authorization header — token-bearer auth is the URL-path invitation
 *   token (and X-Session-Token header for /qa/message), validated server-side.
 * - X-Request-ID added per request to keep correlation parity with the
 *   authed apiClient.
 * - Errors normalised via the same ApiError shape used by the rest of the FE
 *   so callers can use translateApiError() uniformly.
 */
export const apiPublicClient: AxiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

apiPublicClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const headers =
    config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers);
  if (!headers.get("X-Request-ID")) {
    headers.set("X-Request-ID", generateRequestId());
  }
  // Defense-in-depth: explicitly delete Authorization in case a caller
  // attached one. The /sign/* routes are public and must never receive
  // an internal user's Bearer token.
  headers.delete("Authorization");
  config.headers = headers;
  return config;
});

apiPublicClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(normalisePublicAxiosError(error)),
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONTRACTS_BASE = "/api/v1/contracts";
const SIGN_PUBLIC_BASE = "/api/v1/sign";
const SIGNATURE_PARTIES_BASE = "/api/v1/signature-parties";
const SIGNATURE_INVITATIONS_BASE = "/api/v1/signature-invitations";

function publicConfig(extra?: AxiosRequestConfig): AxiosRequestConfig {
  return extra ?? {};
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const signatureService = {
  // ── S1 — bulk-create signature parties ────────────────────────────────────
  /** POST /api/v1/contracts/:id/signature-parties (authed). */
  createPartiesBulk: async (
    contractId: number,
    payload: SignaturePartyCreateBulkDto,
  ): Promise<SignaturePartyCreateBulkResponse> => {
    const { data } = await apiClient.post<SignaturePartyCreateBulkResponse>(
      `${CONTRACTS_BASE}/${contractId}/signature-parties`,
      payload,
    );
    return data;
  },

  // ── S2 — send for signature ──────────────────────────────────────────────
  /** POST /api/v1/contracts/:id/send-for-signature (authed). */
  sendForSignature: async (
    contractId: number,
  ): Promise<SendForSignatureResponse> => {
    const { data } = await apiClient.post<SendForSignatureResponse>(
      `${CONTRACTS_BASE}/${contractId}/send-for-signature`,
      {},
    );
    return data;
  },

  // ── S6 — list signatures for contract ────────────────────────────────────
  /** GET /api/v1/contracts/:id/signatures (authed). */
  listForContract: async (
    contractId: number,
  ): Promise<SignatureListResponse> => {
    const { data } = await apiClient.get<SignatureListResponse>(
      `${CONTRACTS_BASE}/${contractId}/signatures`,
    );
    return data;
  },

  // ── R-RC2 — In-app self-service signing-link resolver ────────────────────
  /**
   * POST /api/v1/contracts/:id/signing-link/self (authed).
   * For an authenticated signer (typically a recipient): rolls the existing
   * pending|viewed|expired invitation to a fresh /sign/{token} URL so the
   * FE can navigate the user directly into the public signing UI without
   * making them open the email. Caller-bound on the BE; rejects with 403
   * if the actor is not a signer on the contract, 410 if the invitation
   * is in a terminal state.
   */
  resolveSigningLinkForSelf: async (
    contractId: number,
  ): Promise<{
    newInvitationId: number;
    invitationTokenPlaintext: string;
    expiresAt: string;
    contractId: number;
    signaturePartyId: number;
  }> => {
    const { data } = await apiClient.post<{
      data: {
        newInvitationId: number;
        invitationTokenPlaintext: string;
        expiresAt: string;
        contractId: number;
        signaturePartyId: number;
      };
    }>(`${CONTRACTS_BASE}/${contractId}/signing-link/self`);
    return data.data;
  },

  // ── S7 — resend invitation ───────────────────────────────────────────────
  /** POST /api/v1/signature-parties/:id/resend (authed). */
  resendInvitation: async (
    signaturePartyId: number,
    payload: ResendInvitationDto = {},
  ): Promise<ResendInvitationResponse> => {
    const { data } = await apiClient.post<ResendInvitationResponse>(
      `${SIGNATURE_PARTIES_BASE}/${signaturePartyId}/resend`,
      payload,
    );
    return data;
  },

  // ── S8 — cancel invitation ───────────────────────────────────────────────
  /** POST /api/v1/signature-invitations/:id/cancel (authed). */
  cancelInvitation: async (
    invitationId: number,
    payload: CancelInvitationDto,
  ): Promise<CancelInvitationResponse> => {
    const { data } = await apiClient.post<CancelInvitationResponse>(
      `${SIGNATURE_INVITATIONS_BASE}/${invitationId}/cancel`,
      payload,
    );
    return data;
  },

  // ── S3 — public landing-page read ────────────────────────────────────────
  /**
   * GET /api/v1/sign/:invitationToken (PUBLIC — verify_jwt=false).
   * Plaintext token in URL path; BE hashes-and-matches.
   */
  getByInvitationToken: async (
    invitationToken: string,
  ): Promise<SignaturePublicViewResponse> => {
    const { data } = await apiPublicClient.get<SignaturePublicViewResponse>(
      `${SIGN_PUBLIC_BASE}/${encodeURIComponent(invitationToken)}`,
      publicConfig(),
    );
    return data;
  },

  // ── S4 — public sign ─────────────────────────────────────────────────────
  /** POST /api/v1/sign/:invitationToken/sign (PUBLIC). */
  sign: async (
    invitationToken: string,
    payload: SignContractDto,
  ): Promise<SignContractResponse> => {
    const { data } = await apiPublicClient.post<SignContractResponse>(
      `${SIGN_PUBLIC_BASE}/${encodeURIComponent(invitationToken)}/sign`,
      payload,
      publicConfig(),
    );
    return data;
  },

  // ── S5 — public decline ──────────────────────────────────────────────────
  /** POST /api/v1/sign/:invitationToken/decline (PUBLIC). */
  decline: async (
    invitationToken: string,
    payload: DeclineContractDto,
  ): Promise<DeclineContractResponse> => {
    const { data } = await apiPublicClient.post<DeclineContractResponse>(
      `${SIGN_PUBLIC_BASE}/${encodeURIComponent(invitationToken)}/decline`,
      payload,
      publicConfig(),
    );
    return data;
  },

  // ── S11 — public Q&A session start ───────────────────────────────────────
  /** POST /api/v1/sign/:invitationToken/qa/session (PUBLIC). */
  qaSessionStart: async (
    invitationToken: string,
    payload: SignerQaSessionStartDto = {},
  ): Promise<SignerQaSessionStartResponse> => {
    const { data } = await apiPublicClient.post<SignerQaSessionStartResponse>(
      `${SIGN_PUBLIC_BASE}/${encodeURIComponent(invitationToken)}/qa/session`,
      payload,
      publicConfig(),
    );
    return data;
  },

  // S12 — see useSignerQaSseStream hook (SSE via fetch + ReadableStream).
};

/**
 * Build the absolute URL for the SSE /qa/message endpoint. Used by the
 * SSE hook which manages its own fetch lifecycle.
 */
export function buildQaMessageUrl(invitationToken: string): string {
  return `${getBaseUrl()}${SIGN_PUBLIC_BASE}/${encodeURIComponent(invitationToken)}/qa/message`;
}

export default signatureService;
