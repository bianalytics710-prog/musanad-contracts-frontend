/**
 * Musanad — Import Batches React Query hooks (M1c).
 *
 * One useQuery / useMutation per endpoint in importBatchService. Every
 * mutation invalidates the parent list (T2). On-success / on-error toasts
 * use translateApiError (F-FE-M2 — never display raw err.message).
 *
 * Polling: in-progress batches refetch every 5s via refetchInterval (NOT
 * setInterval — React Query owns cleanup). Terminal batches stop polling.
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
import { importBatchService } from "@/services/api/import-batch.service";
import { ApiError } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";
import type {
  CreateImportBatchDto,
  CreateImportBatchResponse,
  ImportBatch,
  ImportBatchListQuery,
  ImportBatchListResponse,
  UpdateImportBatchDto,
  UpdateImportBatchResponse,
} from "@/types/entities/import-batch.types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const importBatchKeys = {
  all: ["import-batches"] as const,
  lists: () => [...importBatchKeys.all, "list"] as const,
  list: (q: ImportBatchListQuery) => [...importBatchKeys.lists(), q] as const,
  details: () => [...importBatchKeys.all, "detail"] as const,
  detail: (id: number) => [...importBatchKeys.details(), id] as const,
};

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useImportBatchList(
  query: ImportBatchListQuery = {},
  options?: Omit<
    UseQueryOptions<ImportBatchListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<ImportBatchListResponse, ApiError>({
    queryKey: importBatchKeys.list(query),
    queryFn: () => importBatchService.list(query),
    staleTime: 30_000,
    ...options,
  });
}

/**
 * Single-batch read with conditional polling — when status is in_progress
 * or paused, refetch every 5s for fresh counters / completion. Terminal
 * batches (completed | cancelled) stop polling.
 */
export function useImportBatch(
  id: number | null | undefined,
  options?: Omit<
    UseQueryOptions<ImportBatch, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<ImportBatch, ApiError>({
    queryKey: importBatchKeys.detail(id ?? -1),
    queryFn: () => importBatchService.getById(id as number),
    enabled: typeof id === "number" && id > 0,
    staleTime: 5_000,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "in_progress" || status === "paused") return 5_000;
      return false;
    },
    ...options,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateImportBatch(
  options?: UseMutationOptions<
    CreateImportBatchResponse,
    ApiError,
    CreateImportBatchDto
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<CreateImportBatchResponse, ApiError, CreateImportBatchDto>({
    mutationFn: (payload) => importBatchService.create(payload),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: importBatchKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.import.batchCreateFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useUpdateImportBatch(
  options?: UseMutationOptions<
    UpdateImportBatchResponse,
    ApiError,
    { id: number; data: UpdateImportBatchDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    UpdateImportBatchResponse,
    ApiError,
    { id: number; data: UpdateImportBatchDto }
  >({
    mutationFn: ({ id, data }) => importBatchService.update(id, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: importBatchKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: importBatchKeys.detail(variables.id),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "errors.import.batchUpdateFailed"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}
