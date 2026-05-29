/**
 * Financial Trade Margin service — CR-O M21 Financial Intelligence (Trade half).
 *
 * Wraps all 7 trade-margin endpoints:
 *   GET  /api/v1/financial/trade-margin                          (positions list)
 *   GET  /api/v1/financial/trade-margin/aggregate               (CFO rollup)
 *   GET  /api/v1/financial/trade-margin/:positionId             (position detail)
 *   GET  /api/v1/financial/trade-margin/:positionId/history     (snapshot history)
 *   GET  /api/v1/financial/price-benchmarks                     (benchmark list)
 *   POST /api/v1/financial/price-benchmarks/recompute           (OSP-drop demo action)
 *   POST /api/v1/financial/price-benchmarks                     (record benchmark)
 *
 * A7: apiClient is encapsulated here — pages/components/hooks never import
 * apiClient directly.
 *
 * Envelope note: BE controllers return the raw fn_ JSONB via res.json(result)
 * — they do NOT wrap in { success, data } ApiResponse envelope (same pattern
 * as CR-N financial-budget-burn.service.ts). Each method returns the bare
 * domain type directly.
 */
import { apiClient } from '@/lib/api-client';
import type {
  TradePosition,
  TradePositionListResponse,
  TradePositionListQuery,
  MarginAggregateResult,
  MarginAggregateQuery,
  MarginSnapshotHistoryResult,
  PriceBenchmark,
  PriceBenchmarkListResponse,
  PriceBenchmarkListQuery,
  MarginRecomputeResult,
  RecomputePriceBenchmarkDto,
  RecordPriceBenchmarkDto,
} from '@/types/entities/trade-margin.types';

export const financialTradeMarginService = {
  /**
   * GET /api/v1/financial/trade-margin
   * Paginated positions list with inline latest margin.
   * Permission: finance.margin.read
   */
  listPositions: async (
    params: TradePositionListQuery = {},
  ): Promise<TradePositionListResponse> => {
    const { data } = await apiClient.get<TradePositionListResponse>(
      '/api/v1/financial/trade-margin',
      { params },
    );
    return data;
  },

  /**
   * GET /api/v1/financial/trade-margin/aggregate
   * CFO + trading-desk portfolio rollup.
   * Permission: finance.margin.read
   * IMPORTANT: static /aggregate route must be called before /:positionId.
   */
  getAggregate: async (
    params: MarginAggregateQuery = {},
  ): Promise<MarginAggregateResult> => {
    const { data } = await apiClient.get<MarginAggregateResult>(
      '/api/v1/financial/trade-margin/aggregate',
      { params },
    );
    return data;
  },

  /**
   * GET /api/v1/financial/trade-margin/:positionId
   * Full position detail including costComponents[] and latestMargin block.
   * Permission: finance.margin.read
   */
  getPositionDetail: async (positionId: number): Promise<TradePosition> => {
    const { data } = await apiClient.get<TradePosition>(
      `/api/v1/financial/trade-margin/${positionId}`,
    );
    return data;
  },

  /**
   * GET /api/v1/financial/trade-margin/:positionId/history
   * Margin snapshot history for a single position (ASC computed_at).
   * Permission: finance.margin.read
   */
  getSnapshotHistory: async (
    positionId: number,
    limit?: number,
  ): Promise<MarginSnapshotHistoryResult> => {
    const { data } = await apiClient.get<MarginSnapshotHistoryResult>(
      `/api/v1/financial/trade-margin/${positionId}/history`,
      { params: limit !== undefined ? { limit } : {} },
    );
    return data;
  },

  /**
   * GET /api/v1/financial/price-benchmarks
   * Paginated price benchmark observations.
   * Permission: finance.margin.read
   */
  listBenchmarks: async (
    params: PriceBenchmarkListQuery = {},
  ): Promise<PriceBenchmarkListResponse> => {
    const { data } = await apiClient.get<PriceBenchmarkListResponse>(
      '/api/v1/financial/price-benchmarks',
      { params },
    );
    return data;
  },

  /**
   * POST /api/v1/financial/price-benchmarks/recompute
   * OSP-drop demo action: set new Murban OSP → recompute all open positions.
   * Returns aggregate margin delta (deltaAed/deltaUsd negative = compression).
   * Permission: finance.trade.manage
   */
  recomputeByPrice: async (
    payload: RecomputePriceBenchmarkDto,
  ): Promise<MarginRecomputeResult> => {
    const { data } = await apiClient.post<MarginRecomputeResult>(
      '/api/v1/financial/price-benchmarks/recompute',
      payload,
    );
    return data;
  },

  /**
   * POST /api/v1/financial/price-benchmarks
   * Upsert a price benchmark observation.
   * Permission: finance.trade.manage
   */
  recordBenchmark: async (
    payload: RecordPriceBenchmarkDto,
  ): Promise<PriceBenchmark> => {
    const { data } = await apiClient.post<PriceBenchmark>(
      '/api/v1/financial/price-benchmarks',
      payload,
    );
    return data;
  },
};
