/**
 * M14 / CR-F — Risk Score React Query hooks.
 *
 * Used by ContractRiskTab (health gauge, 5-dim bars, MaR list, history chart,
 * what-if panel).
 */
import { useQuery } from '@tanstack/react-query';
import { riskScoreService } from '@/services/api/risk-score.service';
import type { AvarFilters } from '@/types/entities/risk-score.types';

export const RISK_SCORE_QUERY_KEY = 'riskScore';
export const RISK_SCORE_HISTORY_QUERY_KEY = 'riskScoreHistory';
export const AVAR_QUERY_KEY = 'riskAvar';

/**
 * Latest risk score for a contract — powers ContractRiskTab.
 * staleTime: 5 min (scores are event-driven; polling unnecessary).
 */
export function useContractRiskScore(contractId: number | null) {
  return useQuery({
    queryKey: [RISK_SCORE_QUERY_KEY, contractId],
    queryFn: () => riskScoreService.getRiskScore(contractId!),
    enabled: contractId !== null && contractId > 0,
    staleTime: 5 * 60 * 1_000,
    retry: (failureCount, error) => {
      // Don't retry on 403/404 — these are definitive
      const status = (error as { status?: number })?.status;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Score history snapshots for the ScoreHistoryChart.
 * staleTime: 5 min.
 */
export function useContractRiskScoreHistory(
  contractId: number | null,
  windowDays: 30 | 90 | 180 = 90,
) {
  return useQuery({
    queryKey: [RISK_SCORE_HISTORY_QUERY_KEY, contractId, windowDays],
    queryFn: () => riskScoreService.getRiskScoreHistory(contractId!, windowDays),
    enabled: contractId !== null && contractId > 0,
    staleTime: 5 * 60 * 1_000,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });
}

/**
 * AVaR aggregation for the executive dashboard.
 * staleTime: 30 sec (executive refreshes more often).
 */
export function useAvar(filters: AvarFilters = {}) {
  return useQuery({
    queryKey: [AVAR_QUERY_KEY, filters],
    queryFn: () => riskScoreService.getAvar(filters),
    staleTime: 30 * 1_000,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 403) return false;
      return failureCount < 2;
    },
  });
}
