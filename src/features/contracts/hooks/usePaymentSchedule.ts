/**
 * Musanad — Payment Schedule React Query hooks (M1b).
 *
 * Wraps paymentScheduleService with stable query keys and cache-aware
 * mutation invalidation. Mirrors the pattern used in useContracts.ts (M1a):
 *   - one useQuery per read endpoint (S2 list)
 *   - one useMutation per write endpoint (S3 bulk replace)
 *   - mutations invalidate parent contract queries so PaymentScheduleTab
 *     re-fetches without manual cache work
 *   - all error toasts go through translateApiError so server English
 *     never reaches the user (FE-C5 inheritance from M1a)
 *
 * The Compose Wizard's submit flow (S1) does NOT use the bulkReplace
 * mutation directly — it calls paymentScheduleService.bulkReplace inline
 * inside its own orchestration handler (useComposeSubmit) so it can
 * sequence the contract-create call first. See useComposeSubmit.ts.
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
import { paymentScheduleService } from "@/services/api/payment-schedule.service";
import { ApiError } from "@/lib/api-client";
import { translateApiError } from "@/lib/translate-api-error";
import { contractsKeys } from "@/features/contracts/hooks/useContracts";
import type {
  PaymentScheduleBulkReplaceDto,
  PaymentScheduleBulkReplaceResponse,
  PaymentScheduleListQuery,
  PaymentScheduleListResponse,
} from "@/types/entities/payment-schedule.types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const paymentScheduleKeys = {
  all: ["paymentSchedules"] as const,
  list: (contractId: number, q: PaymentScheduleListQuery = {}) =>
    [...paymentScheduleKeys.all, "list", contractId, q] as const,
};

// ─── Reads (S2) ──────────────────────────────────────────────────────────────

/**
 * useContractPaymentSchedule — fetch the milestone schedule for a contract.
 *
 * `enabled` guard mirrors useContractTree / useContractActivity: query only
 * runs once `contractId` is a positive integer, so the hook is safe to mount
 * before the parent's data has loaded.
 *
 * AC-S2-01: ordered by dueDate ASC NULLS LAST then id ASC (server-side).
 * AC-S2-04: empty data array — not an error — when zero milestones.
 * AC-S2-05: only is_active=true rows returned.
 */
export function useContractPaymentSchedule(
  contractId: number | null | undefined,
  query: PaymentScheduleListQuery = {},
  options?: Omit<
    UseQueryOptions<PaymentScheduleListResponse, ApiError>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery<PaymentScheduleListResponse, ApiError>({
    queryKey: paymentScheduleKeys.list(contractId ?? -1, query),
    queryFn: () => paymentScheduleService.list(contractId as number, query),
    enabled: typeof contractId === "number" && contractId > 0,
    staleTime: 60_000,
    ...options,
  });
}

// ─── Mutations (S3) ──────────────────────────────────────────────────────────

/**
 * useReplacePaymentSchedule — atomic bulk replace of a contract's milestones.
 *
 * onSuccess invalidates BOTH:
 *   1. The payment-schedule list for this contract (refresh the tab UI).
 *   2. The contract activity log (a 'payment_schedule_replaced' row was
 *      emitted server-side per AC-S3-10).
 *
 * Toast pulls the M1b key `contracts.paymentSchedule.toasts.replaceSuccess`
 * with insertedCount + softDeletedCount interpolation so the user can see
 * what actually happened (e.g. "Saved 5 milestones, removed 3").
 */
export function useReplacePaymentSchedule(
  options?: UseMutationOptions<
    PaymentScheduleBulkReplaceResponse,
    ApiError,
    { contractId: number; data: PaymentScheduleBulkReplaceDto }
  >,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    PaymentScheduleBulkReplaceResponse,
    ApiError,
    { contractId: number; data: PaymentScheduleBulkReplaceDto }
  >({
    mutationFn: ({ contractId, data }) => paymentScheduleService.bulkReplace(contractId, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Refresh the tab list.
      queryClient.invalidateQueries({
        queryKey: paymentScheduleKeys.list(variables.contractId),
        // exact:false so any future status-filtered list keys also bust.
        exact: false,
      });
      // Refresh activity (a new payment_schedule_replaced row was emitted).
      queryClient.invalidateQueries({
        queryKey: [...contractsKeys.all, "activity", variables.contractId],
        exact: false,
      });
      toast.success(
        t("contracts.paymentSchedule.toasts.replaceSuccess", {
          inserted: data.inserted,
          softDeleted: data.softDeleted,
        }),
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      toast.error(translateApiError(err, t, "contracts.paymentSchedule.toasts.replaceError"));
      options?.onError?.(err, variables, onMutateResult, context);
    },
    ...options,
  });
}
