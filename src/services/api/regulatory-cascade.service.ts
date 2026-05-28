/**
 * Regulatory Cascade service — CR-M Labor-Law Cascade.
 *
 * Wraps:
 *   POST  /api/v1/regulatory/cascade/run
 *   GET   /api/v1/regulatory/cascade
 *   GET   /api/v1/regulatory/cascade/:runId
 *   PATCH /api/v1/regulatory/cascade/items/:itemId/status
 *   POST  /api/v1/regulatory/cascade/items/:itemId/draft-amendment
 *
 * A7: apiClient is encapsulated here — pages/components/hooks never
 * import apiClient directly.
 */
import { apiClient } from '@/lib/api-client';
import type {
  RegulatoryCascadeRun,
  RegulatoryCascadeRunListResponse,
  RunRegulatoryCascadeDto,
  SetRemediationStatusDto,
  DraftAmendmentDto,
  DraftAmendmentResponse,
  RegulatoryCascadeItemDetail,
  RegulatoryCascadeListQuery,
} from '@/types/entities/regulatory-cascade.types';

// ─── Envelope note (CR-M Integration Verifier fix) ──────────────────────────
// The CR-M controllers return the BARE fn_ JSONB via `res.json(result)` — they
// do NOT wrap in the `{ success, data }` ApiResponse envelope (confirmed in
// regulatory-cascade.controller.ts + migration 289). This matches the existing
// party-graph convention (party-graph.controller.ts / party-graph.service.ts).
// Therefore each method returns the bare domain type, NOT ApiResponse<T>.
//   - list / getById / run / setItemStatus / draftAmendment all yield the
//     bare fn output directly.
//   - apiClient.<verb><T>() returns axios { data: T } where `data` IS the raw
//     HTTP body (no auto-unwrap in the response interceptor).

export const regulatoryCascadeService = {
  /**
   * POST /api/v1/regulatory/cascade/run
   * Permission: regulatory.cascade.run (compliance_esg, platform_admin, Super Admin)
   * BE returns the bare RegulatoryCascadeRun (full run detail).
   */
  run: async (
    payload: RunRegulatoryCascadeDto,
  ): Promise<RegulatoryCascadeRun> => {
    const { data } = await apiClient.post<RegulatoryCascadeRun>(
      '/api/v1/regulatory/cascade/run',
      payload,
    );
    return data;
  },

  /**
   * GET /api/v1/regulatory/cascade
   * Permission: regulatory.cascade.read
   * BE returns the bare { data: [...], pagination: {...} } from fn_regulatory_cascade_list.
   */
  list: async (
    params: RegulatoryCascadeListQuery = {},
  ): Promise<RegulatoryCascadeRunListResponse> => {
    const { data } = await apiClient.get<RegulatoryCascadeRunListResponse>(
      '/api/v1/regulatory/cascade',
      { params },
    );
    return data;
  },

  /**
   * GET /api/v1/regulatory/cascade/:runId
   * Permission: regulatory.cascade.read
   * BE returns the bare RegulatoryCascadeRun (header + items[]).
   */
  getById: async (runId: number): Promise<RegulatoryCascadeRun> => {
    const { data } = await apiClient.get<RegulatoryCascadeRun>(
      `/api/v1/regulatory/cascade/${runId}`,
    );
    return data;
  },

  /**
   * PATCH /api/v1/regulatory/cascade/items/:itemId/status
   * Permission: regulatory.cascade.read (any read-capable persona)
   * BE returns the bare updated RegulatoryCascadeItemDetail.
   */
  setItemStatus: async (
    itemId: number,
    payload: SetRemediationStatusDto,
  ): Promise<RegulatoryCascadeItemDetail> => {
    const { data } = await apiClient.patch<RegulatoryCascadeItemDetail>(
      `/api/v1/regulatory/cascade/items/${itemId}/status`,
      payload,
    );
    return data;
  },

  /**
   * POST /api/v1/regulatory/cascade/items/:itemId/draft-amendment
   * Permission: advisory.draft.review OR regulatory.cascade.run
   * BE returns the bare DraftAmendmentResponse.
   */
  draftAmendment: async (
    itemId: number,
    payload: DraftAmendmentDto,
  ): Promise<DraftAmendmentResponse> => {
    const { data } = await apiClient.post<DraftAmendmentResponse>(
      `/api/v1/regulatory/cascade/items/${itemId}/draft-amendment`,
      payload,
    );
    return data;
  },
};
