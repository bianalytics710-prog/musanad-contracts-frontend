/**
 * Musanad — Signatures React Query hooks (M3).
 *
 * One useQuery / useMutation per endpoint in signatureService.
 *
 * Conventions (M1a/M2 precedent):
 *   - invalidateQueries on every mutation onSuccess.
 *   - toast.success / toast.error on every mutation outcome.
 *   - All errors funnelled through translateApiError — never surface raw
 *     err.response.data or ApiError.message (raw server text leak).
 *   - Sensitive fields (invitationTokenPlaintext, sessionTokenPlaintext,
 *     signatureData, userMessage) are NEVER logged on the client. They flow
 *     through axios body/headers only and are surfaced to the immediate
 *     caller's onSuccess callback (the dialog/drawer state).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";
import { signatureService } from "@/services/api/signature.service";
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

// ─── Query keys ──────────────────────────────────────────────────────────────

export const signatureKeys = {
  all: ["signatures"] as const,
  listForContract: (contractId: number) =>
    [...signatureKeys.all, "listForContract", contractId] as const,
  publicByToken: (invitationToken: string) =>
    [...signatureKeys.all, "publicByToken", invitationToken] as const,
};

// ─── S6 — list signatures for contract ───────────────────────────────────────

export function useSignatureListForContract(
  contractId: number | null | undefined,
  options?: Omit<
    UseQueryOptions<SignatureListResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<SignatureListResponse, ApiError>({
    queryKey: signatureKeys.listForContract(contractId ?? -1),
    queryFn: () =>
      signatureService.listForContract(contractId as number),
    enabled: typeof contractId === "number" && contractId > 0,
    // Signature progress can change rapidly via cron-driven expiry +
    // counterparty signing — keep stale window short.
    staleTime: 10_000,
    ...options,
  });
}

// ─── S3 — public landing-page read ───────────────────────────────────────────

/**
 * PUBLIC route hook. Disable React Query interceptors that depend on the
 * authed apiClient — this hook calls apiPublicClient under the hood.
 */
export function useSignaturePublicView(
  invitationToken: string | null | undefined,
  options?: Omit<
    UseQueryOptions<SignaturePublicViewResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<SignaturePublicViewResponse, ApiError>({
    queryKey: signatureKeys.publicByToken(invitationToken ?? ""),
    queryFn: () =>
      signatureService.getByInvitationToken(invitationToken as string),
    enabled: typeof invitationToken === "string" && invitationToken.length >= 16,
    // Signer page reads should not poll — but on visibility return we
    // allow refetch so a status change (signed/declined/cancelled by
    // another party) lands quickly.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
    ...options,
  });
}

// ─── S1 — bulk-create parties ────────────────────────────────────────────────

export function useCreateSignatureParties(
  options?: UseMutationOptions<
    SignaturePartyCreateBulkResponse,
    ApiError,
    { contractId: number; data: SignaturePartyCreateBulkDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    SignaturePartyCreateBulkResponse,
    ApiError,
    { contractId: number; data: SignaturePartyCreateBulkDto }
  >({
    mutationFn: ({ contractId, data }) =>
      signatureService.createPartiesBulk(contractId, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: signatureKeys.listForContract(variables.contractId),
      });
      // Touch contracts because we may have written contract activity.
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(t("signatures.toasts.partiesCreated"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.signatures.partiesCreateFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S2 — send for signature ─────────────────────────────────────────────────

export function useSendForSignature(
  options?: UseMutationOptions<
    SendForSignatureResponse,
    ApiError,
    { contractId: number }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    SendForSignatureResponse,
    ApiError,
    { contractId: number }
  >({
    mutationFn: ({ contractId }) =>
      signatureService.sendForSignature(contractId),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: signatureKeys.listForContract(variables.contractId),
      });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(t("signatures.toasts.sentForSignature"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.signatures.sendFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S7 — resend invitation ──────────────────────────────────────────────────

export function useResendInvitation(
  options?: UseMutationOptions<
    ResendInvitationResponse,
    ApiError,
    { signaturePartyId: number; data?: ResendInvitationDto; contractId?: number }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    ResendInvitationResponse,
    ApiError,
    { signaturePartyId: number; data?: ResendInvitationDto; contractId?: number }
  >({
    mutationFn: ({ signaturePartyId, data }) =>
      signatureService.resendInvitation(signaturePartyId, data ?? {}),
    onSuccess: (data, variables, onMutateResult, context) => {
      if (variables.contractId) {
        queryClient.invalidateQueries({
          queryKey: signatureKeys.listForContract(variables.contractId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: signatureKeys.all });
      }
      toast.success(t("signatures.toasts.resent"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.signatures.resendFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S8 — cancel invitation ──────────────────────────────────────────────────

export function useCancelInvitation(
  options?: UseMutationOptions<
    CancelInvitationResponse,
    ApiError,
    { invitationId: number; data: CancelInvitationDto; contractId?: number }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    CancelInvitationResponse,
    ApiError,
    { invitationId: number; data: CancelInvitationDto; contractId?: number }
  >({
    mutationFn: ({ invitationId, data }) =>
      signatureService.cancelInvitation(invitationId, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      if (variables.contractId) {
        queryClient.invalidateQueries({
          queryKey: signatureKeys.listForContract(variables.contractId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: signatureKeys.all });
      }
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(t("signatures.toasts.cancelled"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.signatures.cancelFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S4 — public sign ────────────────────────────────────────────────────────

export function useSignContract(
  options?: UseMutationOptions<
    SignContractResponse,
    ApiError,
    { invitationToken: string; data: SignContractDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    SignContractResponse,
    ApiError,
    { invitationToken: string; data: SignContractDto }
  >({
    mutationFn: ({ invitationToken, data }) =>
      signatureService.sign(invitationToken, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Refresh the public view so the post-sign UI reflects the new status.
      queryClient.invalidateQueries({
        queryKey: signatureKeys.publicByToken(variables.invitationToken),
      });
      toast.success(t("sign.m3.toasts.signed"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.signatures.signFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S5 — public decline ─────────────────────────────────────────────────────

export function useDeclineContract(
  options?: UseMutationOptions<
    DeclineContractResponse,
    ApiError,
    { invitationToken: string; data: DeclineContractDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    DeclineContractResponse,
    ApiError,
    { invitationToken: string; data: DeclineContractDto }
  >({
    mutationFn: ({ invitationToken, data }) =>
      signatureService.decline(invitationToken, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: signatureKeys.publicByToken(variables.invitationToken),
      });
      toast.success(t("sign.m3.toasts.declined"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.signatures.declineFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S11 — public Q&A session start ──────────────────────────────────────────

/**
 * NOTE: caller is expected to keep the response.sessionTokenPlaintext in
 * component-local state ONLY. Do NOT persist it to localStorage,
 * sessionStorage, or any other store — it is cleared automatically on
 * drawer close or page unload.
 */
export function useSignerQaSessionStart(
  options?: UseMutationOptions<
    SignerQaSessionStartResponse,
    ApiError,
    { invitationToken: string; data?: SignerQaSessionStartDto }
  >,
) {
  const { t } = useTranslation();
  return useMutation<
    SignerQaSessionStartResponse,
    ApiError,
    { invitationToken: string; data?: SignerQaSessionStartDto }
  >({
    mutationFn: ({ invitationToken, data }) =>
      signatureService.qaSessionStart(invitationToken, data),
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.signatures.qaSessionFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}
