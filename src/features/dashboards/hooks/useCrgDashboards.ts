/**
 * M15 / CR-G — React Query hooks for 4 new persona dashboards.
 *
 * staleTime: 60s (volatile intelligence data — per HITL Q3 60s auto-refresh lock).
 * refetchInterval: 60_000ms — dashboards auto-refresh every 60s per HITL Q3.
 * placeholderData: keepPreviousData so window-change doesn't flash skeleton.
 */

import { keepPreviousData, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import { dashboardsCrgService } from '@/services/api/dashboards-crg.service';
import type {
  OperationsDashboardResponse,
  FinanceTreasuryDashboardResponse,
  ComplianceEsgDashboardResponse,
  ProcurementSupplierRiskDashboardResponse,
} from '@/types/entities/crg-dashboards.types';

const STALE_MS = 60_000;
const REFETCH_MS = 60_000;

// ─── Query key factory ────────────────────────────────────────────────────────

export const crgDashboardKeys = {
  all: ['crg-dashboards'] as const,
  operations: (windowDays: number) =>
    [...crgDashboardKeys.all, 'operations', windowDays] as const,
  financeTreasury: (windowDays: number) =>
    [...crgDashboardKeys.all, 'finance-treasury', windowDays] as const,
  complianceEsg: (windowDays: number) =>
    [...crgDashboardKeys.all, 'compliance-esg', windowDays] as const,
  procurement: (windowDays: number) =>
    [...crgDashboardKeys.all, 'procurement', windowDays] as const,
};

// ─── Operations dashboard ─────────────────────────────────────────────────────

export function useOperationsDashboard(
  windowDays = 30,
  options?: Omit<
    UseQueryOptions<OperationsDashboardResponse, ApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<OperationsDashboardResponse, ApiError>({
    queryKey: crgDashboardKeys.operations(windowDays),
    queryFn: () => dashboardsCrgService.getOperations(windowDays),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── Finance & Treasury dashboard ─────────────────────────────────────────────

export function useFinanceTreasuryDashboard(
  windowDays = 30,
  options?: Omit<
    UseQueryOptions<FinanceTreasuryDashboardResponse, ApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<FinanceTreasuryDashboardResponse, ApiError>({
    queryKey: crgDashboardKeys.financeTreasury(windowDays),
    queryFn: () => dashboardsCrgService.getFinanceTreasury(windowDays),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── Compliance & ESG dashboard ───────────────────────────────────────────────

export function useComplianceEsgDashboard(
  windowDays = 30,
  options?: Omit<
    UseQueryOptions<ComplianceEsgDashboardResponse, ApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<ComplianceEsgDashboardResponse, ApiError>({
    queryKey: crgDashboardKeys.complianceEsg(windowDays),
    queryFn: () => dashboardsCrgService.getComplianceEsg(windowDays),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// ─── Procurement dashboard ────────────────────────────────────────────────────

export function useProcurementDashboard(
  windowDays = 90,
  options?: Omit<
    UseQueryOptions<ProcurementSupplierRiskDashboardResponse, ApiError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<ProcurementSupplierRiskDashboardResponse, ApiError>({
    queryKey: crgDashboardKeys.procurement(windowDays),
    queryFn: () => dashboardsCrgService.getProcurement(windowDays),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
    ...options,
  });
}
