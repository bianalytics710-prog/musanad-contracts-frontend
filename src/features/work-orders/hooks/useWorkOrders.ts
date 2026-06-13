/**
 * M21 — Work Order Queue hooks.
 *
 * - useMyWorkOrders     : drafter's My Work queue (cards + filters)
 * - useOpenWorkOrderCount: sidebar badge (polled)
 * - useAssignableDrafters: exec's dropdown
 * - useCreateDraftFromContract: mutation for the exec modal
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  workOrdersService,
  workOrderKeys,
  type AssignableDrafter,
  type AssignedByMeListResponse,
  type CreateDraftRequestPayload,
  type CreateDraftRequestResponse,
  type ExtractFromSourceResponse,
  type ListAssignedByMeQuery,
  type ListMineQuery,
  type NudgeResponse,
  type OwnerOption,
  type ReassignResponse,
  type WorkOrderListResponse,
  type WorkOrderProgressResponse,
} from "@/services/api/work-orders.service";
import type { ApiError } from "@/lib/api-client";
import { useAuthStore, selectUser } from "@/store/auth.store";

const lastViewedKey = (userId: number | string) =>
  `myWork.lastViewedAt:${userId}`;

function readLastViewedAt(userId: number | string | null): number {
  if (userId == null || typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(lastViewedKey(userId));
  const n = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function markMyWorkViewed(userId: number | string | null): void {
  if (userId == null || typeof window === "undefined") return;
  window.localStorage.setItem(lastViewedKey(userId), new Date().toISOString());
}

export function useMyWorkOrders(query: ListMineQuery = {}) {
  return useQuery<WorkOrderListResponse, ApiError>({
    queryKey: workOrderKeys.list(query),
    queryFn: () => workOrdersService.listMine(query),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

/**
 * M21 — sidecar progress. One query per page load; merged with the listMine
 * data client-side by workOrderId. Designed to fail gracefully — if the
 * endpoint is down, the table still renders without the "Awaiting <name>"
 * detail (Stage column falls back to "Awaiting approval" without the name).
 */
export function useMyWorkProgress() {
  return useQuery<WorkOrderProgressResponse, ApiError>({
    queryKey: workOrderKeys.progress(),
    queryFn: () => workOrdersService.progress(),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}

export function useOpenWorkOrderCount() {
  // Badge shows UNREAD — work orders created AFTER the last time the user
  // visited /app/work. Clearing happens when MyWorkPage mounts (via the
  // markMyWorkViewed helper above + the query invalidation in the hook).
  const user = useAuthStore(selectUser);
  return useQuery<number, ApiError>({
    queryKey: ["workOrders", "unreadCount", user?.id ?? null],
    queryFn: async () => {
      const r = await workOrdersService.listMine({
        status: ["open", "in_progress"],
        limit: 100,
      });
      const lastViewedAt = readLastViewedAt(user?.id ?? null);
      const unread = r.data.filter((wo) => {
        const created = Date.parse(wo.createdAt);
        return Number.isFinite(created) && created > lastViewedAt;
      });
      return unread.length;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: user?.id != null,
  });
}

/**
 * Mounting hook for MyWorkPage. Marks "viewed now" + flushes the badge query
 * so the counter drops to 0 immediately.
 */
export function useMarkMyWorkViewedOnMount() {
  const user = useAuthStore(selectUser);
  const qc = useQueryClient();
  useEffect(() => {
    markMyWorkViewed(user?.id ?? null);
    qc.invalidateQueries({ queryKey: ["workOrders", "unreadCount"] });
  }, [user?.id, qc]);
}

export function useAssignableDrafters(enabled = true) {
  return useQuery<AssignableDrafter[], ApiError>({
    queryKey: workOrderKeys.assignableDrafters(),
    queryFn: () => workOrdersService.assignableDrafters(),
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateDraftRequest() {
  const qc = useQueryClient();
  return useMutation<CreateDraftRequestResponse, ApiError, CreateDraftRequestPayload>({
    mutationFn: (payload) => workOrdersService.createDraftRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workOrderKeys.all });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// M21 mig 638/639 — Executive "Assigned Work" hooks
// ────────────────────────────────────────────────────────────────────────────

export function useAssignedByMeWorkOrders(query: ListAssignedByMeQuery = {}) {
  return useQuery<AssignedByMeListResponse, ApiError>({
    queryKey: workOrderKeys.assignedByMe(query),
    queryFn: () => workOrdersService.listAssignedByMe(query),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useOwnerOptions() {
  return useQuery<OwnerOption[], ApiError>({
    queryKey: workOrderKeys.ownerOptions(),
    queryFn: () => workOrdersService.ownerOptions(),
    staleTime: 60_000,
  });
}

export function useNudgeWorkOrder() {
  const qc = useQueryClient();
  return useMutation<NudgeResponse, ApiError, { id: number; message?: string }>({
    mutationFn: ({ id, message }) => workOrdersService.nudge(id, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workOrderKeys.all });
    },
  });
}

export function useReassignWorkOrder() {
  const qc = useQueryClient();
  return useMutation<
    ReassignResponse,
    ApiError,
    { id: number; newAssigneeId: number; reason?: string }
  >({
    mutationFn: ({ id, newAssigneeId, reason }) =>
      workOrdersService.reassign(id, newAssigneeId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workOrderKeys.all });
    },
  });
}

export function useCancelWorkOrder() {
  const qc = useQueryClient();
  return useMutation<
    { id: number; status: string },
    ApiError,
    { id: number; reason?: string }
  >({
    mutationFn: ({ id, reason }) => workOrdersService.cancel(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workOrderKeys.all });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Phase A (mig 640, 2026-06-13) — unified My Work inbox.
// useMyWorkUnified returns the actor's UNION across work_order + approvals +
// risk cases + tpa reviews + advisory drafts. Persona-aware: the BE filters
// branches by the actor's role. Drafter's existing useMyWorkOrders hook stays
// as-is (it powers their work_order-specific actions like Compose draft).
// ────────────────────────────────────────────────────────────────────────────
import {
  myWorkService,
  myWorkKeys,
  type ListMyWorkQuery,
  type MyWorkListResponse,
} from "@/services/api/my-work.service";

export function useMyWorkUnified(query: ListMyWorkQuery = {}) {
  return useQuery<MyWorkListResponse, ApiError>({
    queryKey: myWorkKeys.list(query),
    queryFn: () => myWorkService.list(query),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useExtractFromSource(sourceContractId: number | null) {
  return useQuery<ExtractFromSourceResponse, ApiError>({
    queryKey: ["workOrders", "extract", sourceContractId],
    queryFn: () => workOrdersService.extractFromSource(sourceContractId!),
    enabled: sourceContractId != null,
    staleTime: 10 * 60_000,
    retry: false,
  });
}
