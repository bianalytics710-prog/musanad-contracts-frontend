/**
 * Musanad — Regulatory Radar React Query hooks (M5).
 *
 * One hook per fn_ in api-contracts.json.
 *
 * Conventions:
 *   - Errors funnelled through translateApiError — never raw err.message.
 *   - Stable, typed queryKeys via the `regulatoryKeys` factory.
 *   - Mutations invalidate the affected lists + detail keys on onSuccess.
 *   - Toasts on mutation success/error use the `regulatory.*` i18n namespace.
 *   - SENSITIVE: BulkDetectRegulatoryImpactDto.impactPayload (AI-generated
 *     content) flows through useMutation → service → axios body only. Never
 *     stored in queryClient cache; never console.log'd.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";
import { regulatoryService } from "@/services/api/regulatory.service";
import type {
  // Regulation
  Regulation,
  RegulationListResponse,
  RegulationListQuery,
  CreateRegulationDto,
  UpdateRegulationDto,
  RegulationCreateResult,
  RegulationUpdateResult,
  RegulationDeleteResult,
  // Regulatory Update
  RegulatoryUpdate,
  RegulatoryUpdateListResponse,
  RegulatoryUpdateListQuery,
  CreateRegulatoryUpdateDto,
  UpdateRegulatoryUpdateDto,
  RegulatoryUpdateCreateResult,
  RegulatoryUpdateUpdateResult,
  RegulatoryUpdateDeleteResult,
  // Regulatory Impact
  RegulatoryImpactListResponse,
  RegulatoryImpactListQuery,
  BulkDetectRegulatoryImpactDto,
  BulkDetectRegulatoryImpactResult,
  ResolveRegulatoryImpactDto,
  RegulatoryImpactResolveResult,
  // Impact Category
  ImpactCategoryListResponse,
  ImpactCategoryListQuery,
  UpsertImpactCategoryDto,
  ImpactCategoryUpsertResult,
} from "@/types/entities/regulatory.types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const regulatoryKeys = {
  all: ["regulatory"] as const,

  // Regulation
  regulations: () => [...regulatoryKeys.all, "regulations"] as const,
  regulationList: (q: RegulationListQuery) =>
    [...regulatoryKeys.regulations(), "list", q] as const,
  regulationDetail: (id: number) =>
    [...regulatoryKeys.regulations(), "detail", id] as const,

  // Regulatory Update
  regulatoryUpdates: () => [...regulatoryKeys.all, "regulatoryUpdates"] as const,
  regulatoryUpdateList: (q: RegulatoryUpdateListQuery) =>
    [...regulatoryKeys.regulatoryUpdates(), "list", q] as const,
  regulatoryUpdateDetail: (id: number) =>
    [...regulatoryKeys.regulatoryUpdates(), "detail", id] as const,

  // Regulatory Impact
  regulatoryImpacts: () => [...regulatoryKeys.all, "regulatoryImpacts"] as const,
  regulatoryImpactList: (q: RegulatoryImpactListQuery) =>
    [...regulatoryKeys.regulatoryImpacts(), "list", q] as const,

  // Impact Category
  impactCategories: () => [...regulatoryKeys.all, "impactCategories"] as const,
  impactCategoryList: (q: ImpactCategoryListQuery) =>
    [...regulatoryKeys.impactCategories(), "list", q] as const,
};

// ════════════════════════════════════════════════════════════════════════════
// Regulation hooks (S1..S5)
// ════════════════════════════════════════════════════════════════════════════

/** S1 — list regulations with filters + pagination (search debounced at caller). */
export function useRegulationList(
  query: RegulationListQuery = {},
  options?: Omit<
    UseQueryOptions<RegulationListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<RegulationListResponse, ApiError>({
    queryKey: regulatoryKeys.regulationList(query),
    queryFn: () => regulatoryService.listRegulations(query),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    ...options,
  });
}

/** S2 — single regulation detail (full payload incl. supersededBy chain). */
export function useRegulationById(
  id: number | null,
  options?: Omit<
    UseQueryOptions<Regulation, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<Regulation, ApiError>({
    queryKey: regulatoryKeys.regulationDetail(id ?? -1),
    queryFn: () => regulatoryService.getRegulationById(id as number),
    enabled: id !== null && id > 0,
    ...options,
  });
}

/** S3 — create regulation. */
export function useCreateRegulation(
  options?: UseMutationOptions<
    RegulationCreateResult,
    ApiError,
    CreateRegulationDto
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<RegulationCreateResult, ApiError, CreateRegulationDto>({
    mutationFn: (payload) => regulatoryService.createRegulation(payload),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      toast.success(t("regulatory.regulation.toast.createSuccess"));
      queryClient.invalidateQueries({ queryKey: regulatoryKeys.regulations() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

/** S4 — patch regulation. supersededById auto-flips status to 'superseded'. */
export function useUpdateRegulation(
  options?: UseMutationOptions<
    RegulationUpdateResult,
    ApiError,
    { id: number; payload: UpdateRegulationDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    RegulationUpdateResult,
    ApiError,
    { id: number; payload: UpdateRegulationDto }
  >({
    mutationFn: ({ id, payload }) =>
      regulatoryService.updateRegulation(id, payload),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      toast.success(t("regulatory.regulation.toast.updateSuccess"));
      queryClient.invalidateQueries({ queryKey: regulatoryKeys.regulations() });
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulationDetail(variables.id),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

/** S5 — soft-delete regulation. T9: caller MUST confirm before invoking. */
export function useDeleteRegulation(
  options?: UseMutationOptions<RegulationDeleteResult, ApiError, number>,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<RegulationDeleteResult, ApiError, number>({
    mutationFn: (id) => regulatoryService.deleteRegulation(id),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      toast.success(t("regulatory.regulation.toast.deleteSuccess"));
      queryClient.invalidateQueries({ queryKey: regulatoryKeys.regulations() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Regulatory Update hooks (S6..S10)
// ════════════════════════════════════════════════════════════════════════════

/** S6 — list regulatory updates (radar feed). */
export function useRegulatoryUpdateList(
  query: RegulatoryUpdateListQuery = {},
  options?: Omit<
    UseQueryOptions<RegulatoryUpdateListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<RegulatoryUpdateListResponse, ApiError>({
    queryKey: regulatoryKeys.regulatoryUpdateList(query),
    queryFn: () => regulatoryService.listRegulatoryUpdates(query),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    ...options,
  });
}

/** S7 — single regulatory update detail (incl. impactSummary aggregate). */
export function useRegulatoryUpdateById(
  id: number | null,
  options?: Omit<
    UseQueryOptions<RegulatoryUpdate, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<RegulatoryUpdate, ApiError>({
    queryKey: regulatoryKeys.regulatoryUpdateDetail(id ?? -1),
    queryFn: () => regulatoryService.getRegulatoryUpdateById(id as number),
    enabled: id !== null && id > 0,
    ...options,
  });
}

/** S8 — create regulatory update. */
export function useCreateRegulatoryUpdate(
  options?: UseMutationOptions<
    RegulatoryUpdateCreateResult,
    ApiError,
    CreateRegulatoryUpdateDto
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    RegulatoryUpdateCreateResult,
    ApiError,
    CreateRegulatoryUpdateDto
  >({
    mutationFn: (payload) => regulatoryService.createRegulatoryUpdate(payload),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      toast.success(t("regulatory.regulatoryUpdate.toast.createSuccess"));
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulatoryUpdates(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

/** S9 — patch regulatory update. publishedDate floor guard at BE. */
export function useUpdateRegulatoryUpdate(
  options?: UseMutationOptions<
    RegulatoryUpdateUpdateResult,
    ApiError,
    { id: number; payload: UpdateRegulatoryUpdateDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    RegulatoryUpdateUpdateResult,
    ApiError,
    { id: number; payload: UpdateRegulatoryUpdateDto }
  >({
    mutationFn: ({ id, payload }) =>
      regulatoryService.updateRegulatoryUpdate(id, payload),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      toast.success(t("regulatory.regulatoryUpdate.toast.updateSuccess"));
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulatoryUpdates(),
      });
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulatoryUpdateDetail(variables.id),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

/** S10 — soft-delete regulatory update. Cascades to dependent impacts. T9 confirm. */
export function useDeleteRegulatoryUpdate(
  options?: UseMutationOptions<
    RegulatoryUpdateDeleteResult,
    ApiError,
    number
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<RegulatoryUpdateDeleteResult, ApiError, number>({
    mutationFn: (id) => regulatoryService.deleteRegulatoryUpdate(id),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      toast.success(t("regulatory.regulatoryUpdate.toast.deleteSuccess"));
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulatoryUpdates(),
      });
      // Cascade deletes impacts, so invalidate that list too
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulatoryImpacts(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Regulatory Impact hooks (S11..S13)
// ════════════════════════════════════════════════════════════════════════════

/**
 * S11 — bulk-detect regulatory impacts.
 *
 * SENSITIVE: BulkDetectRegulatoryImpactDto.impactPayload is AI-generated
 * content. Pass through this hook directly — never destructure into a
 * persisted store, never console.log.
 */
export function useBulkDetectRegulatoryImpacts(
  options?: UseMutationOptions<
    BulkDetectRegulatoryImpactResult,
    ApiError,
    BulkDetectRegulatoryImpactDto
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    BulkDetectRegulatoryImpactResult,
    ApiError,
    BulkDetectRegulatoryImpactDto
  >({
    mutationFn: (payload) =>
      regulatoryService.bulkDetectRegulatoryImpacts(payload),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      toast.success(
        t("regulatory.impact.toast.bulkDetectSuccess", {
          created: data.createdCount,
          skipped: data.skippedDuplicateCount,
        }),
      );
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulatoryImpacts(),
      });
      // bulk-detect changes pendingCount on the parent regulatory_update
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulatoryUpdates(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

/** S12 — list impacts (must specify at least one of contract/regulation/regulatoryUpdate). */
export function useRegulatoryImpactList(
  query: RegulatoryImpactListQuery = {},
  options?: Omit<
    UseQueryOptions<RegulatoryImpactListResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  // AC-S12-02: don't call BE without at least one scoping filter
  const hasScope =
    typeof query.contractId === "number" ||
    typeof query.regulationId === "number" ||
    typeof query.regulatoryUpdateId === "number";
  return useQuery<RegulatoryImpactListResponse, ApiError>({
    queryKey: regulatoryKeys.regulatoryImpactList(query),
    queryFn: () => regulatoryService.listRegulatoryImpacts(query),
    placeholderData: keepPreviousData,
    enabled: hasScope,
    ...options,
  });
}

/** S13 — resolve regulatory impact. T9 confirm at FE. */
export function useResolveRegulatoryImpact(
  options?: UseMutationOptions<
    RegulatoryImpactResolveResult,
    ApiError,
    { id: number; payload: ResolveRegulatoryImpactDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    RegulatoryImpactResolveResult,
    ApiError,
    { id: number; payload: ResolveRegulatoryImpactDto }
  >({
    mutationFn: ({ id, payload }) =>
      regulatoryService.resolveRegulatoryImpact(id, payload),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      toast.success(t("regulatory.impact.toast.resolveSuccess"));
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulatoryImpacts(),
      });
      // resolution updates impactSummary on the parent regulatory_update detail
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.regulatoryUpdates(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Impact Category hooks (S14..S15)
// ════════════════════════════════════════════════════════════════════════════

/**
 * S14 — list impact categories. All authenticated roles (no permission gate
 * beyond JWT — AC-S14-05). Small reference table; long staleTime + cached.
 */
export function useImpactCategoryList(
  query: ImpactCategoryListQuery = {},
  options?: Omit<
    UseQueryOptions<ImpactCategoryListResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<ImpactCategoryListResponse, ApiError>({
    queryKey: regulatoryKeys.impactCategoryList(query),
    queryFn: () => regulatoryService.listImpactCategories(query),
    staleTime: 5 * 60_000, // 5 min — small reference table
    ...options,
  });
}

/**
 * S15 — upsert impact category. POST with `key` in body (BE-OI-A — not PUT/:key).
 * platform_admin only (config.manage; AC-S15-05).
 */
export function useUpsertImpactCategory(
  options?: UseMutationOptions<
    ImpactCategoryUpsertResult,
    ApiError,
    UpsertImpactCategoryDto
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    ImpactCategoryUpsertResult,
    ApiError,
    UpsertImpactCategoryDto
  >({
    mutationFn: (payload) => regulatoryService.upsertImpactCategory(payload),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      const key =
        data.createdOrUpdated === "created"
          ? "regulatory.impactCategory.toast.createSuccess"
          : "regulatory.impactCategory.toast.updateSuccess";
      toast.success(t(key));
      queryClient.invalidateQueries({
        queryKey: regulatoryKeys.impactCategories(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(translateApiError(error, t));
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
