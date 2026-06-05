/**
 * React Query hooks for the /api/v1/templates surface.
 *
 * One useQuery / useMutation per endpoint. Mutations invalidate the lists
 * cache (and the affected detail) so the FE picks up writes without a
 * hard refresh.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  templatesService,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type TemplateDetail,
  type TemplateListItem,
  type ExtractTemplateFromContractInput,
  type ExtractTemplateFromContractResult,
  type AnalyzeTemplateUploadResult,
  type PaginatedResult,
} from "@/services/api/m_parity.service";
import { ApiError } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";

export const templatesKeys = {
  all: ["templates"] as const,
  lists: () => [...templatesKeys.all, "list"] as const,
  list: (q: { contractType?: string; q?: string; limit?: number; offset?: number }) =>
    [...templatesKeys.lists(), q] as const,
  details: () => [...templatesKeys.all, "detail"] as const,
  detail: (id: number) => [...templatesKeys.details(), id] as const,
};

export function useTemplateList(
  query: { contractType?: string; q?: string; limit?: number; offset?: number } = {},
  options?: Omit<
    UseQueryOptions<PaginatedResult<TemplateListItem>, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<PaginatedResult<TemplateListItem>, ApiError>({
    queryKey: templatesKeys.list(query),
    queryFn: () => templatesService.list(query),
    staleTime: 60_000,
    ...options,
  });
}

export function useTemplateDetail(
  id: number | null,
  options?: Omit<
    UseQueryOptions<TemplateDetail, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<TemplateDetail, ApiError>({
    queryKey: templatesKeys.detail(id ?? -1),
    queryFn: () => templatesService.getById(id!),
    enabled: id !== null && id > 0,
    staleTime: 60_000,
    ...options,
  });
}

export function useCreateTemplate() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation<TemplateDetail, ApiError, CreateTemplateInput>({
    mutationFn: (input) => templatesService.create(input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      queryClient.setQueryData(templatesKeys.detail(data.id), data);
      toast.success(t("templates.toasts.created", { defaultValue: "Template created" }));
    },
    onError: (err) => {
      toast.error(translateApiError(err, t, "errors.template.createFailed"));
    },
  });
}

export function useUpdateTemplate(id: number) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation<TemplateDetail, ApiError, UpdateTemplateInput>({
    mutationFn: (input) => templatesService.update(id, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      queryClient.setQueryData(templatesKeys.detail(id), data);
      toast.success(t("templates.toasts.updated", { defaultValue: "Template updated" }));
    },
    onError: (err) => {
      toast.error(translateApiError(err, t, "errors.template.updateFailed"));
    },
  });
}

export function useDeleteTemplate() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation<{ id: number; deleted: boolean }, ApiError, number>({
    mutationFn: (id) => templatesService.remove(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      queryClient.removeQueries({ queryKey: templatesKeys.detail(id) });
      toast.success(t("templates.toasts.deleted", { defaultValue: "Template deleted" }));
    },
    onError: (err) => {
      toast.error(translateApiError(err, t, "errors.template.deleteFailed"));
    },
  });
}

export function useExtractTemplateFromContract() {
  const { t } = useTranslation();
  return useMutation<
    ExtractTemplateFromContractResult,
    ApiError,
    ExtractTemplateFromContractInput
  >({
    mutationFn: (input) => templatesService.extractFromContract(input),
    onError: (err) => {
      toast.error(translateApiError(err, t, "errors.template.extractFailed"));
    },
  });
}

/**
 * Phase 2 — fan-out hook for New Template upload. Returns the extracted
 * template + similarity matches + clause cross-check in one call. The page
 * uses this in place of useExtractTemplateFromContract.
 */
export function useAnalyzeTemplateUpload() {
  const { t } = useTranslation();
  return useMutation<
    AnalyzeTemplateUploadResult,
    ApiError,
    ExtractTemplateFromContractInput
  >({
    mutationFn: (input) => templatesService.analyzeUpload(input),
    onError: (err) => {
      toast.error(translateApiError(err, t, "errors.template.extractFailed"));
    },
  });
}
