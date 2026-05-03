/**
 * Musanad — Contracts React Query hooks (M1a).
 *
 * One useQuery / useMutation per endpoint in contractsService. Every
 * mutation invalidates its parent list (T2 React Query rule) and shows
 * a toast on success/error (T9 destructive confirmation already lives
 * in the dialog component — these toasts are the post-mutation feedback).
 *
 * Query keys are namespaced under ['contracts', ...] so a single global
 * invalidation can rebuild the whole feature surface after a write.
 *
 * NB: TanStack Query v5+ user-callback signatures take 4 arguments —
 *     (data, variables, onMutateResult, context) on success and
 *     (error, variables, onMutateResult, context) on error. We forward
 *     all four to the consumer's optional override.
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
import { contractsService } from "@/services/api/contracts.service";
import { ApiError } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";
import type {
  Contract,
  ContractListQuery,
  ContractListResponse,
  ContractTreeResponse,
  ContractVersionListQuery,
  ContractVersionListResponse,
  ContractActivityListQuery,
  ContractActivityListResponse,
  CreateContractDto,
  CreateContractResponse,
  CreateContractVersionDto,
  CreateContractVersionResponse,
  DeleteContractResponse,
  SetContractTagsDto,
  SetContractTagsResponse,
  UpdateContractDto,
  UpdateContractResponse,
  UpdateContractStatusDto,
  UpdateContractStatusResponse,
} from "@/types/entities/contract.types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const contractsKeys = {
  all: ["contracts"] as const,
  lists: () => [...contractsKeys.all, "list"] as const,
  list: (q: ContractListQuery) => [...contractsKeys.lists(), q] as const,
  details: () => [...contractsKeys.all, "detail"] as const,
  detail: (id: number) => [...contractsKeys.details(), id] as const,
  tree: (id: number) => [...contractsKeys.all, "tree", id] as const,
  versions: (id: number, q: ContractVersionListQuery) =>
    [...contractsKeys.all, "versions", id, q] as const,
  activity: (id: number, q: ContractActivityListQuery) =>
    [...contractsKeys.all, "activity", id, q] as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// NOTE: Earlier revisions of this file surfaced `ApiError.message` directly
// in toasts, which leaked untranslated server text to users (Codex FE-C5).
// All mutation onError paths now go through `translateApiError`, which
// maps `code` (and validation `details.field`) to stable i18n keys with a
// localized generic fallback.

// ─── Reads (S1, S2, S7, S9, S11) ─────────────────────────────────────────────

export function useContractList(
  query: ContractListQuery = {},
  options?: Omit<UseQueryOptions<ContractListResponse, ApiError>, "queryKey" | "queryFn">,
) {
  return useQuery<ContractListResponse, ApiError>({
    queryKey: contractsKeys.list(query),
    queryFn: () => contractsService.list(query),
    staleTime: 60_000,
    ...options,
  });
}

export function useContract(
  id: number | null | undefined,
  options?: Omit<UseQueryOptions<Contract, ApiError>, "queryKey" | "queryFn" | "enabled">,
) {
  return useQuery<Contract, ApiError>({
    queryKey: contractsKeys.detail(id ?? -1),
    queryFn: () => contractsService.getById(id as number),
    enabled: typeof id === "number" && id > 0,
    staleTime: 60_000,
    ...options,
  });
}

export function useContractTree(
  id: number | null | undefined,
  options?: Omit<
    UseQueryOptions<ContractTreeResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<ContractTreeResponse, ApiError>({
    queryKey: contractsKeys.tree(id ?? -1),
    queryFn: () => contractsService.getTree(id as number),
    enabled: typeof id === "number" && id > 0,
    staleTime: 60_000,
    ...options,
  });
}

export function useContractVersions(
  id: number | null | undefined,
  query: ContractVersionListQuery = {},
  options?: Omit<
    UseQueryOptions<ContractVersionListResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<ContractVersionListResponse, ApiError>({
    queryKey: contractsKeys.versions(id ?? -1, query),
    queryFn: () => contractsService.listVersions(id as number, query),
    enabled: typeof id === "number" && id > 0,
    staleTime: 60_000,
    ...options,
  });
}

export function useContractActivity(
  id: number | null | undefined,
  query: ContractActivityListQuery = {},
  options?: Omit<
    UseQueryOptions<ContractActivityListResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<ContractActivityListResponse, ApiError>({
    queryKey: contractsKeys.activity(id ?? -1, query),
    queryFn: () => contractsService.listActivity(id as number, query),
    enabled: typeof id === "number" && id > 0,
    staleTime: 30_000,
    ...options,
  });
}

// ─── Mutations (S3, S4, S5, S6, S8, S10) ─────────────────────────────────────

export function useCreateContract(
  options?: UseMutationOptions<CreateContractResponse, ApiError, CreateContractDto>,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<CreateContractResponse, ApiError, CreateContractDto>({
    mutationFn: (payload) => contractsService.create(payload),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: contractsKeys.lists() });
      toast.success(t("contracts.toasts.createSuccess"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "contracts.toasts.createError"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useUpdateContract(
  options?: UseMutationOptions<
    UpdateContractResponse,
    ApiError,
    { id: number; data: UpdateContractDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<UpdateContractResponse, ApiError, { id: number; data: UpdateContractDto }>({
    mutationFn: ({ id, data }) => contractsService.update(id, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: contractsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contractsKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: contractsKeys.all });
      toast.success(t("contracts.toasts.updateSuccess"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "contracts.toasts.updateError"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useDeleteContract(
  options?: UseMutationOptions<DeleteContractResponse, ApiError, number>,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<DeleteContractResponse, ApiError, number>({
    mutationFn: (id) => contractsService.remove(id),
    onSuccess: (data, id, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: contractsKeys.all });
      queryClient.removeQueries({ queryKey: contractsKeys.detail(id) });
      toast.success(t("contracts.toasts.deleteSuccess"));
      options?.onSuccess?.(data, id, onMutateResult, context);
    },
    onError: (err, id, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "contracts.toasts.deleteError"));
      options?.onError?.(err, id, onMutateResult, context);
    },
    ...options,
  });
}

export function useUpdateContractStatus(
  options?: UseMutationOptions<
    UpdateContractStatusResponse,
    ApiError,
    { id: number; data: UpdateContractStatusDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    UpdateContractStatusResponse,
    ApiError,
    { id: number; data: UpdateContractStatusDto }
  >({
    mutationFn: ({ id, data }) => contractsService.updateStatus(id, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: contractsKeys.all });
      toast.success(t("contracts.toasts.statusSuccess"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "contracts.toasts.statusError"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useSetContractTags(
  options?: UseMutationOptions<
    SetContractTagsResponse,
    ApiError,
    { id: number; data: SetContractTagsDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<SetContractTagsResponse, ApiError, { id: number; data: SetContractTagsDto }>({
    mutationFn: ({ id, data }) => contractsService.setTags(id, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: contractsKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: contractsKeys.lists() });
      toast.success(t("contracts.toasts.tagsSuccess"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "contracts.toasts.tagsError"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useCreateContractVersion(
  options?: UseMutationOptions<
    CreateContractVersionResponse,
    ApiError,
    { id: number; data: CreateContractVersionDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    CreateContractVersionResponse,
    ApiError,
    { id: number; data: CreateContractVersionDto }
  >({
    mutationFn: ({ id, data }) => contractsService.createVersion(id, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: contractsKeys.all });
      toast.success(t("contracts.toasts.versionSuccess"));
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "contracts.toasts.versionError"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}
