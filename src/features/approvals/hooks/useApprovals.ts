/**
 * Musanad — Approvals React Query hooks (M2).
 *
 * One useQuery / useMutation per endpoint in approvalService +
 * approvalMatrixService + approvalChainsService.
 *
 * Conventions (M1a/M1c precedent):
 *   - invalidateQueries on every mutation onSuccess.
 *   - toast.success / toast.error on every mutation outcome.
 *   - All errors funnelled through translateApiError (F-FE-M2) — never
 *     surface raw err.response.data or ApiError.message.
 *   - Sensitive fields (decisionNote) flow through axios; never logged
 *     by FE code (T13).
 *
 * Polling: useMyPendingApprovals defaults to refetchInterval=30s for the
 * approver inbox (S1 AC). Disable by passing refetchInterval: false.
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
import { approvalService } from "@/services/api/approval.service";
import { approvalMatrixService } from "@/services/api/admin/approval-matrix.service";
import { approvalChainsService } from "@/services/api/admin/approval-chains.service";
import type {
  ApprovalChainGetResponse,
  ApprovalChainListQuery,
  ApprovalChainListResponse,
  ApprovalMatrixListQuery,
  ApprovalMatrixListResponse,
  ApprovalMatrixSetResponse,
  DecideApprovalDto,
  DecideApprovalResponse,
  DelegateApprovalDto,
  DelegateApprovalResponse,
  MyPendingApprovalListQuery,
  MyPendingApprovalListResponse,
  ReassignApprovalDto,
  ReassignApprovalResponse,
  RouteInitPreviewRequest,
  RouteInitPreviewResponse,
  SubmitForApprovalRequest,
  SubmitForApprovalResponse,
  UpdateApprovalMatrixDto,
} from "@/types/entities/approval.types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const approvalKeys = {
  all: ["approvals"] as const,
  myPending: (q: MyPendingApprovalListQuery) =>
    [...approvalKeys.all, "myPending", q] as const,
  chainByContract: (contractId: number) =>
    [...approvalKeys.all, "chainByContract", contractId] as const,
};

export const approvalMatrixKeys = {
  all: ["approval-matrix"] as const,
  list: (q: ApprovalMatrixListQuery) =>
    [...approvalMatrixKeys.all, "list", q] as const,
};

export const approvalChainsKeys = {
  all: ["approval-chains"] as const,
  list: (q: ApprovalChainListQuery) =>
    [...approvalChainsKeys.all, "list", q] as const,
};

// ─── S1 — My pending approvals ───────────────────────────────────────────────

const MY_PENDING_DEFAULT_REFETCH_MS = 30_000;

export function useMyPendingApprovals(
  query: MyPendingApprovalListQuery = {},
  options?: Omit<
    UseQueryOptions<MyPendingApprovalListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<MyPendingApprovalListResponse, ApiError>({
    queryKey: approvalKeys.myPending(query),
    queryFn: () => approvalService.myPending(query),
    // S1 AC — approver inbox auto-refreshes; caller can override.
    refetchInterval: MY_PENDING_DEFAULT_REFETCH_MS,
    staleTime: 15_000,
    ...options,
  });
}

// ─── S2 — Decide ─────────────────────────────────────────────────────────────

export function useDecideApproval(
  options?: UseMutationOptions<
    DecideApprovalResponse,
    ApiError,
    { stepId: number; data: DecideApprovalDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    DecideApprovalResponse,
    ApiError,
    { stepId: number; data: DecideApprovalDto }
  >({
    mutationFn: ({ stepId, data }) => approvalService.decide(stepId, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      // Touch contracts because chain transitions update contract.status.
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      // Decision-specific toast key — caller can override via options.
      const key =
        variables.data.decision === "approve"
          ? "approvals.toasts.approved"
          : variables.data.decision === "reject"
            ? "approvals.toasts.rejected"
            : "approvals.toasts.resubmissionRequested";
      toast.success(t(key));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.approval.decideFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S3 — Delegate ───────────────────────────────────────────────────────────

export function useDelegateApproval(
  options?: UseMutationOptions<
    DelegateApprovalResponse,
    ApiError,
    { stepId: number; data: DelegateApprovalDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    DelegateApprovalResponse,
    ApiError,
    { stepId: number; data: DelegateApprovalDto }
  >({
    mutationFn: ({ stepId, data }) => approvalService.delegate(stepId, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      toast.success(t("approvals.toasts.delegated"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.approval.delegateFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── A38 (Aisha audit) — Delegate candidates (name+role picker source) ─────

import type { DelegateCandidatesResponse } from "@/services/api/approval.service";

export function useDelegateCandidates(
  stepId: number | null | undefined,
  options?: Omit<
    UseQueryOptions<DelegateCandidatesResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<DelegateCandidatesResponse, ApiError>({
    queryKey: [...approvalKeys.all, "delegateCandidates", stepId],
    queryFn: () => approvalService.delegateCandidates(stepId as number),
    enabled: typeof stepId === "number" && stepId > 0,
    staleTime: 60_000,
    ...options,
  });
}

// ─── S6 — Preview ────────────────────────────────────────────────────────────

export function usePreviewApprovalChain(
  options?: UseMutationOptions<
    RouteInitPreviewResponse,
    ApiError,
    { contractId: number; data: RouteInitPreviewRequest }
  >,
) {
  const { t } = useTranslation();
  return useMutation<
    RouteInitPreviewResponse,
    ApiError,
    { contractId: number; data: RouteInitPreviewRequest }
  >({
    mutationFn: ({ contractId, data }) =>
      approvalService.previewChain(contractId, data),
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.approval.previewFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S7 — Submit for approval ────────────────────────────────────────────────

export function useSubmitForApproval(
  options?: UseMutationOptions<
    SubmitForApprovalResponse,
    ApiError,
    { contractId: number; data?: SubmitForApprovalRequest }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    SubmitForApprovalResponse,
    ApiError,
    { contractId: number; data?: SubmitForApprovalRequest }
  >({
    mutationFn: ({ contractId, data }) =>
      approvalService.submitForApproval(contractId, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({
        queryKey: approvalKeys.chainByContract(variables.contractId),
      });
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      toast.success(t("approvals.toasts.submitted"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.approval.submitFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S10 — Get chain by contract ─────────────────────────────────────────────

export function useApprovalChainByContract(
  contractId: number | null | undefined,
  options?: Omit<
    UseQueryOptions<ApprovalChainGetResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<ApprovalChainGetResponse, ApiError>({
    queryKey: approvalKeys.chainByContract(contractId ?? -1),
    queryFn: () => approvalService.getChainByContractId(contractId as number),
    enabled: typeof contractId === "number" && contractId > 0,
    staleTime: 30_000,
    ...options,
  });
}

// ─── S4 — Approval matrix list ───────────────────────────────────────────────

export function useApprovalMatrixList(
  query: ApprovalMatrixListQuery = {},
  options?: Omit<
    UseQueryOptions<ApprovalMatrixListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<ApprovalMatrixListResponse, ApiError>({
    queryKey: approvalMatrixKeys.list(query),
    queryFn: () => approvalMatrixService.list(query),
    staleTime: 60_000,
    ...options,
  });
}

// ─── S5 — Approval matrix set (upsert) ───────────────────────────────────────

export function useSetApprovalMatrix(
  options?: UseMutationOptions<
    ApprovalMatrixSetResponse,
    ApiError,
    UpdateApprovalMatrixDto
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<ApprovalMatrixSetResponse, ApiError, UpdateApprovalMatrixDto>({
    mutationFn: (payload) => approvalMatrixService.set(payload),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: approvalMatrixKeys.all });
      toast.success(t("approvals.toasts.matrixSaved"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.approval.matrixSaveFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

// ─── S11 — Admin approval chains list ────────────────────────────────────────

export function useApprovalChainsList(
  query: ApprovalChainListQuery = {},
  options?: Omit<
    UseQueryOptions<ApprovalChainListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<ApprovalChainListResponse, ApiError>({
    queryKey: approvalChainsKeys.list(query),
    queryFn: () => approvalChainsService.list(query),
    // Chains can transition rapidly — keep stale window short.
    staleTime: 10_000,
    ...options,
  });
}

// ─── S8 — Admin reassign step ────────────────────────────────────────────────

export function useReassignApproval(
  options?: UseMutationOptions<
    ReassignApprovalResponse,
    ApiError,
    { stepId: number; data: ReassignApprovalDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    ReassignApprovalResponse,
    ApiError,
    { stepId: number; data: ReassignApprovalDto }
  >({
    mutationFn: ({ stepId, data }) => approvalChainsService.reassign(stepId, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: approvalChainsKeys.all });
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      toast.success(t("approvals.toasts.reassigned"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.approval.reassignFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}
