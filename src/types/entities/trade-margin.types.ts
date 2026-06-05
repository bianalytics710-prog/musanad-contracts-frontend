/**
 * CR-O — Oil-Trade Margin (M21 Financial Intelligence, Trade half)
 * TypeScript Type Definitions — FE copy.
 *
 * Derived from contracts.md Part 1 (Agent 5 output, 2026-05-29).
 * Field names are validated 1-to-1 against §D fn JSONB keys in db-design.md.
 * Do NOT edit manually — regenerate via Agent 5 if DB design changes.
 *
 * MONEY NOTE: price/margin/volume fields typed as string (NUMERIC → ::text).
 * FE must parseFloat() before arithmetic or .toFixed() — never call .toFixed()
 * on a raw string without parseFloat() first.
 *
 * Import path for api.types adjusted for FE: '../api.types'
 */

import type { ApiResponse, PaginationMeta } from '../api.types';

// -----------------------------------------------------------
// 1. Closed-set string unions
// -----------------------------------------------------------

export type TradeSide = 'sell' | 'buy';

export type TradeGrade =
  | 'murban'
  | 'west_african_x'
  | 'brent'
  | 'dubai'
  | 'wti'
  | 'other';

export type BenchmarkCode =
  | 'murban_osp'
  | 'brent'
  | 'dubai'
  | 'wti'
  | 'west_african_x'
  | 'usd_aed';

export type BenchmarkUnit = 'usd_per_bbl' | 'aed_per_usd';

export type BenchmarkPeriodGrain = 'monthly' | 'daily' | 'spot';

export type BenchmarkSource = 'osp_official' | 'market' | 'mock';

export type PricingBasis = 'murban_osp' | 'brent' | 'dubai' | 'wti' | 'spot';

export type TermOrSpot = 'term' | 'spot';

export type TradePositionStatus = 'open' | 'priced' | 'closed';

export type ComponentType =
  | 'lifting'
  | 'transport_charter'
  | 'insurance'
  | 'hedge'
  | 'crude_purchase'
  | 'refining'
  | 'transport'
  | 'storage'
  | 'downstream_sale';

export type MarginTriggeredBy =
  | 'manual'
  | 'price_change'
  | 'worker'
  | 'bootstrap';

export type MarginRecommendation = 'buy' | 'hold' | 'sell' | 'review';

export type TradeDataClassification = 'demo' | 'pilot' | 'production';

/**
 * E-rev-H — Price-protection band status returned by fn_trade_position_list
 * (mig 491). Drives the FE bandStatus pill + escalate-to-drafter flow.
 */
export type BandStatus =
  | 'within_band'
  | 'at_floor'
  | 'at_ceiling'
  | 'below_floor'
  | 'above_ceiling'
  | 'no_band';

// -----------------------------------------------------------
// 2. PriceBenchmark entity
// -----------------------------------------------------------

/** JSONB key mapping validated 1-to-1 against §D-6 / §D-9 */
export interface PriceBenchmark {
  id: number;
  benchmarkCode: BenchmarkCode;
  /** ISO date string (YYYY-MM-DD) */
  priceDate: string;
  /** MONEY — string (NUMERIC(12,4) as text). parseFloat() before display. */
  priceValue: string;
  unit: BenchmarkUnit;
  periodGrain: BenchmarkPeriodGrain;
  source: BenchmarkSource;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
  isActive: boolean;
}

/** JSONB key mapping validated against §D-6 data[] */
export interface PriceBenchmarkListItem {
  id: number;
  benchmarkCode: BenchmarkCode;
  priceDate: string;
  /** MONEY — string */
  priceValue: string;
  unit: BenchmarkUnit;
  periodGrain: BenchmarkPeriodGrain;
  source: BenchmarkSource;
  notes: string | null;
}

export interface PriceBenchmarkListResponse {
  data: PriceBenchmarkListItem[];
  pagination: PaginationMeta;
}

// -----------------------------------------------------------
// 3. Write DTOs
// -----------------------------------------------------------

export interface RecordPriceBenchmarkDto {
  benchmarkCode: BenchmarkCode;
  priceDate: string;
  priceValue: string | number;
  unit: BenchmarkUnit;
  periodGrain?: BenchmarkPeriodGrain;
  source?: BenchmarkSource;
  notes?: string | null;
}

export interface RecomputePriceBenchmarkDto {
  benchmarkCode: BenchmarkCode;
  /** MONEY — string or number; BE coerces to NUMERIC. Non-negative. */
  newPrice: string | number;
  priceDate?: string;
}

// -----------------------------------------------------------
// 4. TradePosition entity
// -----------------------------------------------------------

/** CounterpartySummary — JSONB: id, nameEn, nameAr */
export interface CounterpartySummary {
  id: number;
  nameEn: string;
  nameAr: string | null;
}

/** LinkedContractSummary — JSONB: id, contractNumber, titleEn, titleAr */
export interface LinkedContractSummary {
  id: number;
  contractNumber: string;
  titleEn: string;
  titleAr: string | null;
}

/** CostComponentItem — JSONB: id, componentType, amountUsdPerBbl (string), isRevenue, notes */
export interface CostComponentItem {
  id: number;
  componentType: ComponentType;
  /** MONEY — string (NUMERIC(12,4) as text). parseFloat() before arithmetic. */
  amountUsdPerBbl: string;
  /** TRUE for downstream_sale (buyer revenue leg). */
  isRevenue: boolean;
  notes: string | null;
}

/**
 * LatestMarginBlock — inline latest margin from latest_margin MV.
 * JSONB: marginPerBbl, totalMarginUsd, totalMarginAed, recommendation, latestComputedAt
 */
export interface LatestMarginBlock {
  /** MONEY — string */
  marginPerBbl: string;
  /** MONEY — string */
  totalMarginUsd: string;
  /** MONEY — string (AED as ::text) */
  totalMarginAed: string;
  recommendation: MarginRecommendation | null;
  latestComputedAt: string;
}

/**
 * TradePosition — full detail entity from fn_trade_position_get §D-5.
 * JSONB key mapping validated 1-to-1 against §D-5 (21 keys).
 */
export interface TradePosition {
  id: number;
  positionRef: string;
  side: TradeSide;
  grade: TradeGrade;
  counterparty: CounterpartySummary;
  internalEntity: CounterpartySummary | null;
  /** MONEY — string (NUMERIC(18,2) as text). parseFloat() before arithmetic. */
  volumeBbl: string;
  pricingBasis: PricingBasis;
  /** ISO date string (YYYY-MM-DD), first of month */
  deliveryMonth: string;
  termOrSpot: TermOrSpot;
  linkedContract: LinkedContractSummary | null;
  status: TradePositionStatus;
  notes: string | null;
  costComponents: CostComponentItem[];
  /** null when no margin_snapshot has been computed yet */
  latestMargin: LatestMarginBlock | null;
  dataClassification: TradeDataClassification;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
  isActive: boolean;
  // E-rev-H — Price-protection band projection (mig 492).
  contractedFloorUsdPerBbl?: string | null;
  contractedCeilingUsdPerBbl?: string | null;
  bandReviewClauseRef?: string | null;
  latestBenchmarkUsdPerBbl?: string | null;
  bandStatus?: BandStatus;
}

/**
 * TradePositionListItem — list projection from fn_trade_position_list §D-4.
 * JSONB key mapping validated 1-to-1 against §D-4 (15 keys).
 */
export interface TradePositionListItem {
  id: number;
  positionRef: string;
  side: TradeSide;
  grade: TradeGrade;
  counterparty: CounterpartySummary;
  /** MONEY — string */
  volumeBbl: string;
  pricingBasis: PricingBasis;
  deliveryMonth: string;
  termOrSpot: TermOrSpot;
  status: TradePositionStatus;
  /** MONEY — string | null (null before first compute) */
  marginPerBbl: string | null;
  /** MONEY — string | null */
  totalMarginUsd: string | null;
  /** MONEY — string | null (AED as ::text) */
  totalMarginAed: string | null;
  recommendation: MarginRecommendation | null;
  latestComputedAt: string | null;
  // E-rev-H — Price-protection band projection (mig 491).
  contractedFloorUsdPerBbl?: string | null;
  contractedCeilingUsdPerBbl?: string | null;
  bandReviewClauseRef?: string | null;
  latestBenchmarkUsdPerBbl?: string | null;
  bandStatus?: BandStatus;
}

export interface TradePositionListResponse {
  data: TradePositionListItem[];
  pagination: PaginationMeta;
}

// -----------------------------------------------------------
// 5. fn_margin_compute return shape (§D-1)
// -----------------------------------------------------------

/** MarginRevenueItem — JSONB: label, type, usdPerBbl (string) */
export interface MarginRevenueItem {
  label: string;
  type: 'benchmark' | 'component';
  /** MONEY — string */
  usdPerBbl: string;
}

/** MarginCostItem — JSONB: componentType, usdPerBbl (string) */
export interface MarginCostItem {
  componentType: ComponentType;
  /** MONEY — string */
  usdPerBbl: string;
}

/** MarginBreakdownFx — JSONB: code, rate (string) */
export interface MarginBreakdownFx {
  code: string;
  /** MONEY — string */
  rate: string;
}

/**
 * MarginBreakdown — JSONB: revenue[], costs[], totalCostPerBbl, marginPerBbl, fx
 * Validated 1-to-1 against §D-1 breakdown.
 */
export interface MarginBreakdown {
  revenue: MarginRevenueItem[];
  costs: MarginCostItem[];
  /** MONEY — string */
  totalCostPerBbl: string;
  /** MONEY — string */
  marginPerBbl: string;
  fx: MarginBreakdownFx;
}

/**
 * MarginComputeResult — fn_margin_compute §D-1 return shape.
 * JSONB key mapping validated 1-to-1 (17 top-level keys).
 */
export interface MarginComputeResult {
  tradePositionId: number;
  positionRef: string;
  side: TradeSide;
  grade: TradeGrade;
  /** MONEY — string */
  volumeBbl: string;
  benchmarkCodeUsed: string | null;
  /** MONEY — string | null (null for buyer side) */
  benchmarkPriceUsed: string | null;
  /** MONEY — string */
  revenuePerBbl: string;
  /** MONEY — string */
  costPerBbl: string;
  /** MONEY — string. May be negative (loss position). */
  marginPerBbl: string;
  /** MONEY — string */
  totalMarginUsd: string;
  /** MONEY — string (NUMERIC(12,4) as text) */
  usdAedRate: string;
  /** MONEY — string (AED as ::text) */
  totalMarginAed: string;
  recommendation: MarginRecommendation;
  breakdown: MarginBreakdown;
  computedAt: string;
  triggeredBy: MarginTriggeredBy;
}

// -----------------------------------------------------------
// 6. fn_margin_recompute_for_price_change return shape (§D-2)
// -----------------------------------------------------------

/**
 * MarginRecomputeResult — §D-2 return shape.
 * JSONB key mapping validated 1-to-1 (9 keys).
 */
export interface MarginRecomputeResult {
  benchmarkCode: string;
  /** MONEY — string */
  newPrice: string;
  priceDate: string;
  positionsRecomputed: number;
  deduplicatedCount: number;
  /** MONEY — string. Portfolio aggregate before recompute. */
  priorAggregateMarginAed: string;
  /** MONEY — string. Portfolio aggregate after recompute. */
  newAggregateMarginAed: string;
  /** MONEY — string. Negative = margin compression. */
  deltaAed: string;
  /** MONEY — string. Negative = margin compression. */
  deltaUsd: string;
  recomputedPositionIds: number[];
}

// -----------------------------------------------------------
// 7. fn_margin_aggregate return shape (§D-3)
// -----------------------------------------------------------

/**
 * MarginAggregateBucket — §D-3 breakdown[].
 * JSONB: key, label, marginAed, marginUsd, positionCount, pctOfTotal
 */
export interface MarginAggregateBucket {
  key: string;
  label: string;
  /** MONEY — string */
  marginAed: string;
  /** MONEY — string */
  marginUsd: string;
  positionCount: number;
  pctOfTotal: number;
}

/**
 * MarginAggregateResult — fn_margin_aggregate §D-3 return shape.
 * JSONB key mapping validated 1-to-1 (6 keys + 6 bucket keys).
 */
export interface MarginAggregateResult {
  /** MONEY — string */
  totalMarginAed: string;
  /** MONEY — string */
  totalMarginUsd: string;
  currency: string;
  positionCount: number;
  groupBy: 'counterparty' | 'quarter' | 'side';
  breakdown: MarginAggregateBucket[];
}

// -----------------------------------------------------------
// 8. fn_margin_snapshot_history return shape (§D-8)
// -----------------------------------------------------------

/**
 * MarginSnapshotHistoryItem — §D-8 snapshots[].
 * JSONB key mapping validated 1-to-1 (9 keys). ASC computed_at order.
 */
export interface MarginSnapshotHistoryItem {
  marginSnapshotId: number;
  computedAt: string;
  /** MONEY — string | null (null for buyer snapshots — no benchmark) */
  benchmarkPriceUsed: string | null;
  /** MONEY — string */
  revenuePerBbl: string;
  /** MONEY — string */
  costPerBbl: string;
  /** MONEY — string */
  marginPerBbl: string;
  /** MONEY — string */
  totalMarginUsd: string;
  /** MONEY — string (AED as ::text) */
  totalMarginAed: string;
  triggeredBy: MarginTriggeredBy;
}

/**
 * MarginSnapshotHistoryResult — fn_margin_snapshot_history §D-8 return shape.
 * JSONB: tradePositionId, count, snapshots[]
 */
export interface MarginSnapshotHistoryResult {
  tradePositionId: number;
  count: number;
  snapshots: MarginSnapshotHistoryItem[];
}

// -----------------------------------------------------------
// 9. Executive dashboard — additive tradeMarginSummary key (§D-11)
// -----------------------------------------------------------

export interface TradeMarginSummaryBySideEntry {
  positionCount: number;
  /** MONEY — string */
  marginAed: string;
}

export interface TradeMarginSummaryBySide {
  sell: TradeMarginSummaryBySideEntry;
  buy: TradeMarginSummaryBySideEntry;
}

/** JSONB: benchmarkCode, deltaAed, deltaUsd, asOf */
export interface TradeMarginSummaryRecentChange {
  benchmarkCode: string;
  /** MONEY — string. Negative = compression. */
  deltaAed: string;
  /** MONEY — string */
  deltaUsd: string;
  asOf: string;
}

/** JSONB: tradePositionId, positionRef, side, counterpartyName, totalMarginAed */
export interface TradeMarginSummaryTopRow {
  tradePositionId: number;
  positionRef: string;
  side: TradeSide;
  counterpartyName: string;
  /** MONEY — string */
  totalMarginAed: string;
}

/**
 * mig 592 — One outside-band contract for the executive rollup. Sourced
 * from fn_executive_index_linked_outside_band; appended onto
 * tradeMarginSummary.outsideBand by the dashboards service.
 */
export interface TradeMarginSummaryOutsideBandRow {
  tradePositionId: number;
  positionRef: string;
  counterpartyName: string;
  /** Same enum as fn_trade_position_list (mig 491). */
  bandStatus: 'above_ceiling' | 'below_floor' | 'no_band';
  /** MONEY — string. 0 for no_band (no current breach, but flagged for amendment). */
  marginImpactAed: string;
  /** False ⇒ requires contract amendment to add a price-protection clause. */
  hasClause: boolean;
  /** Pre-rendered "Ceiling $102 vs benchmark $103" / "No clause" label. */
  thresholdLabel: string;
}

/**
 * mig 592 — Outside-band / unprotected aggregate. Drives the new KPI tiles
 * and bottom list in ExecutiveTradeMarginSection. Always present on a fresh
 * payload; legacy clients that haven't refreshed types should treat it as
 * optional (BE returns it under tradeMarginSummary).
 */
export interface TradeMarginSummaryOutsideBand {
  /** Total positions in above_ceiling | below_floor | no_band. */
  count: number;
  /** MONEY — string. Sum of marginImpactAed across flagged positions. */
  marginAtRiskAed: string;
  /** Subset of count: positions with no clause (need contract amendment). */
  needsAmendmentCount: number;
  /** Headline benchmark; same code used in recentMarginChange (e.g. murban_osp). */
  benchmarkCode: string | null;
  /** Benchmark spot price the impact is computed against (USD/bbl). */
  benchmarkPriceUsd: string | null;
  /** Date of the benchmark price (YYYY-MM-DD). */
  asOf: string | null;
  /** Top 3 contracts ordered by marginImpactAed DESC. */
  contracts: TradeMarginSummaryOutsideBandRow[];
}

/**
 * TradeMarginSummary — 11th additive key on fn_dashboard_executive output.
 * JSONB key mapping validated 1-to-1 against §D-11 (6 top-level keys).
 *
 * Consumers use the intersection type pattern:
 *   type ExtendedExecDashboard = ExecutiveDashboardSnapshot
 *     & { budgetBurnSummary: BudgetBurnSummary }
 *     & { tradeMarginSummary: TradeMarginSummary }
 * Do NOT modify ExecutiveDashboardSnapshot or dashboards.types.ts.
 */
export interface TradeMarginSummary {
  openPositionCount: number;
  /** MONEY — string */
  totalMarginAed: string;
  /** MONEY — string */
  totalMarginUsd: string;
  bySide: TradeMarginSummaryBySide;
  /** null when no price_change-triggered snapshots exist yet */
  recentMarginChange: TradeMarginSummaryRecentChange | null;
  topPositionsByMargin3: TradeMarginSummaryTopRow[];
  /**
   * mig 592 — outside-band rollup merged in by the BE dashboards service.
   * Optional because older BE deploys may not return it; FE guards.
   */
  outsideBand?: TradeMarginSummaryOutsideBand;
}

// -----------------------------------------------------------
// 10. Query-string shapes
// -----------------------------------------------------------

export interface TradePositionListQuery {
  side?: TradeSide;
  grade?: TradeGrade;
  status?: TradePositionStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PriceBenchmarkListQuery {
  benchmarkCode?: BenchmarkCode;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface MarginAggregateQuery {
  groupBy?: 'counterparty' | 'quarter' | 'side';
}

// -----------------------------------------------------------
// 11. Response envelope aliases
// -----------------------------------------------------------

export type MarginComputeEnvelope = ApiResponse<MarginComputeResult>;
export type MarginRecomputeEnvelope = ApiResponse<MarginRecomputeResult>;
export type MarginAggregateEnvelope = ApiResponse<MarginAggregateResult>;
export type MarginSnapshotHistoryEnvelope = ApiResponse<MarginSnapshotHistoryResult>;
export type TradePositionListEnvelope = ApiResponse<TradePositionListResponse>;
export type TradePositionDetailEnvelope = ApiResponse<TradePosition>;
export type PriceBenchmarkListEnvelope = ApiResponse<PriceBenchmarkListResponse>;
export type RecordPriceBenchmarkEnvelope = ApiResponse<PriceBenchmark>;
