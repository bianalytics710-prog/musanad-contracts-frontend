/**
 * Musanad — M6 Dashboards & Reporting — React Query hooks.
 *
 * One read-hook per fn_ in api-contracts.json. M6 is read-only — no
 * mutations. The S8 anomalies-history GET pairs with M4's existing
 * useAiExecutiveAnomalies mutation (POST /api/v1/ai/executive-anomalies)
 * for the on-demand refresh action (AC-S8-03).
 *
 * Conventions:
 *   - Errors funnelled through translateApiError at the consumer.
 *   - Stable, typed queryKeys via the dashboardsKeys factory.
 *   - staleTime defaults to 60s for dashboards (volatile data; window
 *     pills should refetch quickly when the user changes range).
 *   - Health probe gets 30s staleTime + 60s refetchInterval — admins
 *     expect "live-ish" status without polling on every render.
 *   - Router (S6) uses 5min staleTime — a user's primary role rarely
 *     changes mid-session.
 *   - placeholderData: keepPreviousData on window-keyed queries so the
 *     UI doesn't flash a skeleton when only the window changes.
 */

import {
  keepPreviousData,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { dashboardsService } from "@/services/api/dashboards.service";
import type {
  AdminDashboardSnapshot,
  AiCostSummary,
  ApproverDashboardSnapshot,
  DashboardRouterResponse,
  DashboardWindowQuery,
  DrafterDashboardSnapshot,
  ExecutiveAnomaliesHistoryQuery,
  ExecutiveAnomaliesHistoryResponse,
  ExecutiveDashboardSnapshot,
  HealthCheckSnapshot,
  LegalCounselDashboardSnapshot,
  RecipientDashboardSnapshot,
} from "@/types/entities/dashboards.types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const dashboardsKeys = {
  all: ["dashboards"] as const,
  admin: (q: DashboardWindowQuery) =>
    [...dashboardsKeys.all, "admin", q] as const,
  drafter: (q: DashboardWindowQuery) =>
    [...dashboardsKeys.all, "drafter", q] as const,
  approver: (q: DashboardWindowQuery) =>
    [...dashboardsKeys.all, "approver", q] as const,
  legalCounsel: (q: DashboardWindowQuery) =>
    [...dashboardsKeys.all, "legalCounsel", q] as const,
  recipient: (q: DashboardWindowQuery) =>
    [...dashboardsKeys.all, "recipient", q] as const,
  router: () => [...dashboardsKeys.all, "router"] as const,
  executive: (q: DashboardWindowQuery) =>
    [...dashboardsKeys.all, "executive", q] as const,
  executiveAnomaliesHistory: (q: ExecutiveAnomaliesHistoryQuery) =>
    [...dashboardsKeys.all, "executiveAnomaliesHistory", q] as const,
  aiCostSummary: (q: DashboardWindowQuery) =>
    [...dashboardsKeys.all, "aiCostSummary", q] as const,
  adminHealth: () => [...dashboardsKeys.all, "adminHealth"] as const,
};

const DEFAULT_DASHBOARD_STALE_MS = 60_000;
const HEALTH_STALE_MS = 30_000;
const HEALTH_REFETCH_MS = 60_000;
const ROUTER_STALE_MS = 5 * 60_000;

// ─── S1 / S13 — admin dashboard ─────────────────────────────────────────────

export function useAdminDashboard(
  query: DashboardWindowQuery = {},
  options?: Omit<
    UseQueryOptions<AdminDashboardSnapshot, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<AdminDashboardSnapshot, ApiError>({
    queryKey: dashboardsKeys.admin(query),
    queryFn: () => dashboardsService.getAdminDashboard(query),
    staleTime: DEFAULT_DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── S2 — drafter dashboard ─────────────────────────────────────────────────

export function useDrafterDashboard(
  query: DashboardWindowQuery = {},
  options?: Omit<
    UseQueryOptions<DrafterDashboardSnapshot, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<DrafterDashboardSnapshot, ApiError>({
    queryKey: dashboardsKeys.drafter(query),
    queryFn: () => dashboardsService.getDrafterDashboard(query),
    staleTime: DEFAULT_DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── S3 — approver dashboard ────────────────────────────────────────────────

export function useApproverDashboard(
  query: DashboardWindowQuery = {},
  options?: Omit<
    UseQueryOptions<ApproverDashboardSnapshot, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<ApproverDashboardSnapshot, ApiError>({
    queryKey: dashboardsKeys.approver(query),
    queryFn: () => dashboardsService.getApproverDashboard(query),
    staleTime: DEFAULT_DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── S4 — legal-counsel dashboard ───────────────────────────────────────────

export function useLegalCounselDashboard(
  query: DashboardWindowQuery = {},
  options?: Omit<
    UseQueryOptions<LegalCounselDashboardSnapshot, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<LegalCounselDashboardSnapshot, ApiError>({
    queryKey: dashboardsKeys.legalCounsel(query),
    queryFn: () => dashboardsService.getLegalCounselDashboard(query),
    staleTime: DEFAULT_DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── S5 — recipient dashboard ───────────────────────────────────────────────

export function useRecipientDashboard(
  query: DashboardWindowQuery = {},
  options?: Omit<
    UseQueryOptions<RecipientDashboardSnapshot, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<RecipientDashboardSnapshot, ApiError>({
    queryKey: dashboardsKeys.recipient(query),
    queryFn: () => dashboardsService.getRecipientDashboard(query),
    staleTime: DEFAULT_DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── S6 — router (any authenticated user) ───────────────────────────────────

export function useDashboardRouter(
  options?: Omit<
    UseQueryOptions<DashboardRouterResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<DashboardRouterResponse, ApiError>({
    queryKey: dashboardsKeys.router(),
    queryFn: () => dashboardsService.getRouter(),
    staleTime: ROUTER_STALE_MS,
    ...options,
  });
}

// ─── S7 — executive dashboard ───────────────────────────────────────────────

export function useExecutiveDashboard(
  query: DashboardWindowQuery = {},
  options?: Omit<
    UseQueryOptions<ExecutiveDashboardSnapshot, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<ExecutiveDashboardSnapshot, ApiError>({
    queryKey: dashboardsKeys.executive(query),
    queryFn: () => dashboardsService.getExecutiveDashboard(query),
    staleTime: DEFAULT_DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── S8 — executive anomalies history ───────────────────────────────────────

export function useExecutiveAnomaliesHistory(
  query: ExecutiveAnomaliesHistoryQuery = {},
  options?: Omit<
    UseQueryOptions<ExecutiveAnomaliesHistoryResponse, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<ExecutiveAnomaliesHistoryResponse, ApiError>({
    queryKey: dashboardsKeys.executiveAnomaliesHistory(query),
    queryFn: () => dashboardsService.getExecutiveAnomaliesHistory(query),
    staleTime: DEFAULT_DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── S11 — AI cost summary ──────────────────────────────────────────────────

export function useAiCostSummary(
  query: DashboardWindowQuery = {},
  options?: Omit<
    UseQueryOptions<AiCostSummary, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<AiCostSummary, ApiError>({
    queryKey: dashboardsKeys.aiCostSummary(query),
    queryFn: () => dashboardsService.getAiCostSummary(query),
    staleTime: DEFAULT_DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── S12 — admin health ─────────────────────────────────────────────────────

export function useAdminHealth(
  options?: Omit<
    UseQueryOptions<HealthCheckSnapshot, ApiError>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<HealthCheckSnapshot, ApiError>({
    queryKey: dashboardsKeys.adminHealth(),
    queryFn: () => dashboardsService.getAdminHealth(),
    staleTime: HEALTH_STALE_MS,
    refetchInterval: HEALTH_REFETCH_MS,
    refetchIntervalInBackground: false,
    ...options,
  });
}
