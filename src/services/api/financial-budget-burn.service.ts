/**
 * Financial Budget Burn service — CR-N M21 Financial Intelligence.
 *
 * Wraps all 9 budget-burn endpoints:
 *   GET  /api/v1/financial/budget-burn                       (portfolio)
 *   GET  /api/v1/financial/budget-burn/budgets               (budget list)
 *   GET  /api/v1/financial/budget-burn/budgets/:id           (budget detail)
 *   GET  /api/v1/financial/budget-burn/cost-actuals          (actuals list)
 *   GET  /api/v1/financial/budget-burn/:contractId           (burn compute)
 *   GET  /api/v1/financial/budget-burn/:contractId/variance  (variance)
 *   GET  /api/v1/financial/budget-burn/:contractId/projection (projection)
 *   POST /api/v1/financial/budget-burn/:contractId/cost-actuals (record actual)
 *   POST /api/v1/financial/budget-burn/variance/:contractId/draft-cure-notice
 *
 * A7: apiClient is encapsulated here — pages/components/hooks never import
 * apiClient directly.
 *
 * Envelope note: BE controllers return the raw fn_ JSONB via res.json(result)
 * — they do NOT wrap in { success, data } ApiResponse envelope (same pattern
 * as CR-M regulatory-cascade.controller.ts). Each method returns the bare
 * domain type directly (not ApiResponse<T>).
 */
import { apiClient } from '@/lib/api-client';
import type {
  BudgetBurnPortfolio,
  BudgetBurnCompute,
  BudgetVarianceResult,
  BudgetYearEndProjection,
  ContractBudget,
  ContractBudgetListResponse,
  ContractCostActual,
  ContractCostActualListResponse,
  DraftCureNoticeDto,
  DraftCureNoticeResponse,
  RecordCostActualDto,
  PortfolioQuery,
  BudgetListQuery,
  CostActualListQuery,
} from '@/types/entities/budget-burn.types';

export const financialBudgetBurnService = {
  /**
   * GET /api/v1/financial/budget-burn
   * Portfolio rollup across all budgeted contracts.
   * Permission: finance.budget.read
   */
  getPortfolio: async (
    params: PortfolioQuery = {},
  ): Promise<BudgetBurnPortfolio> => {
    const { data } = await apiClient.get<BudgetBurnPortfolio>(
      '/api/v1/financial/budget-burn',
      { params },
    );
    return data;
  },

  /**
   * GET /api/v1/financial/budget-burn/:contractId
   * Detailed budget-vs-actual burn view for one contract.
   * Permission: finance.budget.read
   */
  getBurnCompute: async (contractId: number): Promise<BudgetBurnCompute> => {
    const { data } = await apiClient.get<BudgetBurnCompute>(
      `/api/v1/financial/budget-burn/${contractId}`,
    );
    return data;
  },

  /**
   * GET /api/v1/financial/budget-burn/:contractId/variance
   * Variance breaches + correlated clause refs + cure-notice eligibility.
   * Permission: finance.budget.read
   */
  getVariance: async (
    contractId: number,
    thresholdPct?: number,
  ): Promise<BudgetVarianceResult> => {
    const { data } = await apiClient.get<BudgetVarianceResult>(
      `/api/v1/financial/budget-burn/${contractId}/variance`,
      { params: thresholdPct !== undefined ? { thresholdPct } : {} },
    );
    return data;
  },

  /**
   * GET /api/v1/financial/budget-burn/:contractId/projection
   * Year-end projection via run-rate extrapolation.
   * Permission: finance.budget.read
   */
  getProjection: async (
    contractId: number,
    asOfPeriod?: string,
  ): Promise<BudgetYearEndProjection> => {
    const { data } = await apiClient.get<BudgetYearEndProjection>(
      `/api/v1/financial/budget-burn/${contractId}/projection`,
      { params: asOfPeriod ? { asOfPeriod } : {} },
    );
    return data;
  },

  /**
   * GET /api/v1/financial/budget-burn/:contractId/milestones
   * mig 594 — event-based milestone list (rig acceptance, first well TD, etc.)
   * Permission: finance.budget.read
   */
  listMilestones: async (
    contractId: number,
  ): Promise<{
    data: Array<{
      id: number;
      milestoneCode: string;
      labelEn: string;
      labelAr: string | null;
      plannedEventDate: string;
      plannedAmountAed: string;
      actualEventDate: string | null;
      actualAmountAed: string | null;
      status: 'planned' | 'in_progress' | 'achieved' | 'missed' | 'forfeited';
      notes: string | null;
    }>;
    totals: {
      plannedTotalAed: string;
      actualTotalAed: string;
      achievedCount: number;
      inProgressCount: number;
      plannedCount: number;
      missedCount: number;
    };
  }> => {
    const { data } = await apiClient.get(
      `/api/v1/financial/budget-burn/${contractId}/milestones`,
    );
    return data as Awaited<ReturnType<typeof financialBudgetBurnService.listMilestones>>;
  },

  /**
   * GET /api/v1/financial/budget-burn/budgets
   * Paginated budget lines.
   * Permission: finance.budget.read
   */
  listBudgets: async (
    params: BudgetListQuery = {},
  ): Promise<ContractBudgetListResponse> => {
    const { data } = await apiClient.get<ContractBudgetListResponse>(
      '/api/v1/financial/budget-burn/budgets',
      { params },
    );
    return data;
  },

  /**
   * GET /api/v1/financial/budget-burn/budgets/:id
   * Get one budget line by id (with embedded contract summary).
   * Permission: finance.budget.read
   */
  getBudgetById: async (id: number): Promise<ContractBudget> => {
    const { data } = await apiClient.get<ContractBudget>(
      `/api/v1/financial/budget-burn/budgets/${id}`,
    );
    return data;
  },

  /**
   * GET /api/v1/financial/budget-burn/cost-actuals
   * Paginated actual-spend lines.
   * Permission: finance.budget.read
   */
  listCostActuals: async (
    params: CostActualListQuery = {},
  ): Promise<ContractCostActualListResponse> => {
    const { data } = await apiClient.get<ContractCostActualListResponse>(
      '/api/v1/financial/budget-burn/cost-actuals',
      { params },
    );
    return data;
  },

  /**
   * POST /api/v1/financial/budget-burn/:contractId/cost-actuals
   * Record a single actual-spend line (upsert semantics).
   * Permission: finance.budget.manage
   */
  recordCostActual: async (
    contractId: number,
    payload: RecordCostActualDto,
  ): Promise<ContractCostActual> => {
    const { data } = await apiClient.post<ContractCostActual>(
      `/api/v1/financial/budget-burn/${contractId}/cost-actuals`,
      payload,
    );
    return data;
  },

  /**
   * POST /api/v1/financial/budget-burn/variance/:contractId/draft-cure-notice
   * Generate budget_cure_notice_v1 advisory draft.
   * Permission: advisory.draft.review
   */
  draftCureNotice: async (
    contractId: number,
    payload: DraftCureNoticeDto = {},
  ): Promise<DraftCureNoticeResponse> => {
    const { data } = await apiClient.post<DraftCureNoticeResponse>(
      `/api/v1/financial/budget-burn/variance/${contractId}/draft-cure-notice`,
      payload,
    );
    return data;
  },
};
