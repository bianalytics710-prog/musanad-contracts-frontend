/**
 * M12 / CR-D — Clause Taxonomy Service.
 *
 * A7 compliance: all HTTP calls go through this service.
 * Wraps GET /api/v1/admin/clause-taxonomy.
 */
import { apiClient, unwrap } from '@/lib/api-client';
import type { ClauseTaxonomyListResponse, ClauseFamily } from '@/types/entities/clause.types';

export interface ClauseTaxonomyListParams {
  family?: ClauseFamily;
  search?: string;
  isActive?: boolean;
}

export const clauseTaxonomyService = {
  /**
   * GET /api/v1/admin/clause-taxonomy
   * Returns all 50 clause types grouped by family.
   * Gated: clause.taxonomy.read (all roles).
   */
  list: async (params: ClauseTaxonomyListParams = {}): Promise<ClauseTaxonomyListResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: ClauseTaxonomyListResponse }>(
      '/api/v1/admin/clause-taxonomy',
      { params },
    );
    return unwrap<ClauseTaxonomyListResponse>(data);
  },
};
