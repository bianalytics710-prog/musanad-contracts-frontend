/**
 * M13 / CR-E — Correlation Rules Service.
 *
 * A7 compliance: all HTTP calls go through this service.
 * Wraps:
 *   GET    /api/v1/admin/rules
 *   POST   /api/v1/admin/rules
 *   PATCH  /api/v1/admin/rules/:id
 *   DELETE /api/v1/admin/rules/:id
 *   GET    /api/v1/admin/rules/:id
 *   POST   /api/v1/admin/rules/:id/test
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type {
  CorrelationRule,
  CorrelationRuleListResponse,
  CreateCorrelationRuleDto,
  UpdateCorrelationRuleDto,
  RuleTestAgainstFixtureRequest,
  RuleTestAgainstFixtureResult,
} from '@/types/entities/rule.types';

export interface RuleListParams {
  page?: number;
  limit?: number;
  enabled?: boolean;
  scenario?: string;
  search?: string;
}

export const rulesService = {
  /**
   * GET /api/v1/admin/rules
   * Paginated list of correlation rules. Gated: rule.read.
   */
  list: async (params: RuleListParams = {}): Promise<CorrelationRuleListResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: CorrelationRuleListResponse }>(
      '/api/v1/admin/rules',
      { params },
    );
    return unwrap<CorrelationRuleListResponse>(data);
  },

  /**
   * GET /api/v1/admin/rules/:id
   * Fetch a single rule with fixtures. Gated: rule.read.
   */
  getById: async (id: number): Promise<CorrelationRule> => {
    const { data } = await apiClient.get<{ success: boolean; data: CorrelationRule }>(
      `/api/v1/admin/rules/${id}`,
    );
    return unwrap<CorrelationRule>(data);
  },

  /**
   * POST /api/v1/admin/rules
   * Create a new correlation rule. Gated: rule.manage.
   */
  create: async (payload: CreateCorrelationRuleDto): Promise<CorrelationRule> => {
    const { data } = await apiClient.post<{ success: boolean; data: CorrelationRule }>(
      '/api/v1/admin/rules',
      payload,
    );
    return unwrap<CorrelationRule>(data);
  },

  /**
   * PATCH /api/v1/admin/rules/:id
   * Update an existing rule. Gated: rule.manage.
   */
  update: async (id: number, payload: UpdateCorrelationRuleDto): Promise<CorrelationRule> => {
    const { data } = await apiClient.patch<{ success: boolean; data: CorrelationRule }>(
      `/api/v1/admin/rules/${id}`,
      payload,
    );
    return unwrap<CorrelationRule>(data);
  },

  /**
   * DELETE /api/v1/admin/rules/:id
   * Soft-delete a rule (is_active = false). Gated: rule.manage.
   */
  delete: async (id: number): Promise<{ id: number; isActive: boolean }> => {
    const { data } = await apiClient.delete<{ success: boolean; data: { id: number; isActive: boolean } }>(
      `/api/v1/admin/rules/${id}`,
    );
    return unwrap<{ id: number; isActive: boolean }>(data);
  },

  /**
   * POST /api/v1/admin/rules/:id/test
   * Run rule against fixture (pure simulation). Gated: rule.manage.
   */
  testAgainstFixture: async (
    id: number,
    payload: RuleTestAgainstFixtureRequest,
  ): Promise<RuleTestAgainstFixtureResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: RuleTestAgainstFixtureResult }>(
      `/api/v1/admin/rules/${id}/test`,
      payload,
    );
    return unwrap<RuleTestAgainstFixtureResult>(data);
  },
};
