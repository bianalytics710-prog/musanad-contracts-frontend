/**
 * Musanad — Regulatory Radar API service (M5).
 *
 * Thin axios wrappers over the 15 M5 endpoints. Paths and shapes derived
 * directly from .claude/workspace/current-module/api-contracts.json.
 *
 * Endpoint inventory (15 total — all JWT, zero new PUBLIC):
 *   S1  GET    /api/v1/regulations
 *   S2  GET    /api/v1/regulations/:id
 *   S3  POST   /api/v1/regulations
 *   S4  PATCH  /api/v1/regulations/:id
 *   S5  DELETE /api/v1/regulations/:id
 *   S6  GET    /api/v1/regulatory-updates
 *   S7  GET    /api/v1/regulatory-updates/:id
 *   S8  POST   /api/v1/regulatory-updates
 *   S9  PATCH  /api/v1/regulatory-updates/:id
 *   S10 DELETE /api/v1/regulatory-updates/:id
 *   S11 POST   /api/v1/regulatory-impacts/bulk-detect       (impactPayload SENSITIVE)
 *   S12 GET    /api/v1/regulatory-impacts
 *   S13 PATCH  /api/v1/regulatory-impacts/:id/resolve
 *   S14 GET    /api/v1/impact-categories
 *   S15 POST   /api/v1/impact-categories                    (key in BODY — BE-OI-A)
 *
 * The api-client interceptor handles JWT, X-Request-ID, refresh-token
 * rotation, and error normalisation (ApiError). These methods only own the
 * request/response wire shapes.
 *
 * SENSITIVE: BulkDetectRegulatoryImpactDto.impactPayload is AI-generated content.
 * It flows ONLY through the axios body. Never console.log it. Never persist
 * it in localStorage or sessionStorage. Pino redaction handles BE-side.
 */

import { apiClient } from "@/lib/api-client";
import type {
  // Regulation
  Regulation,
  RegulationListResponse,
  RegulationListQuery,
  CreateRegulationDto,
  UpdateRegulationDto,
  RegulationCreateResult,
  RegulationUpdateResult,
  RegulationDeleteResult,
  // Regulatory Update
  RegulatoryUpdate,
  RegulatoryUpdateListResponse,
  RegulatoryUpdateListQuery,
  CreateRegulatoryUpdateDto,
  UpdateRegulatoryUpdateDto,
  RegulatoryUpdateCreateResult,
  RegulatoryUpdateUpdateResult,
  RegulatoryUpdateDeleteResult,
  // Regulatory Impact
  RegulatoryImpactListResponse,
  RegulatoryImpactListQuery,
  BulkDetectRegulatoryImpactDto,
  BulkDetectRegulatoryImpactResult,
  ResolveRegulatoryImpactDto,
  RegulatoryImpactResolveResult,
  // Impact Category
  ImpactCategoryListResponse,
  ImpactCategoryListQuery,
  UpsertImpactCategoryDto,
  ImpactCategoryUpsertResult,
} from "@/types/entities/regulatory.types";

const REGULATIONS = "/api/v1/regulations";
const REGULATORY_UPDATES = "/api/v1/regulatory-updates";
const REGULATORY_IMPACTS = "/api/v1/regulatory-impacts";
const IMPACT_CATEGORIES = "/api/v1/impact-categories";

/**
 * Strip undefined / empty-string values from a query object so axios does
 * not serialise them as `?key=`. Mirrors the contracts service helper.
 */
function toParams(q: object | undefined): Record<string, unknown> {
  if (!q) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

export const regulatoryService = {
  // ─── Regulation ───────────────────────────────────────────────────────────

  /** S1 — GET /api/v1/regulations. */
  listRegulations: async (
    query: RegulationListQuery = {},
  ): Promise<RegulationListResponse> => {
    const { data } = await apiClient.get<RegulationListResponse>(REGULATIONS, {
      params: toParams(query),
    });
    return data;
  },

  /** S2 — GET /api/v1/regulations/:id. */
  getRegulationById: async (id: number): Promise<Regulation> => {
    const { data } = await apiClient.get<Regulation>(`${REGULATIONS}/${id}`);
    return data;
  },

  /** S3 — POST /api/v1/regulations. */
  createRegulation: async (
    payload: CreateRegulationDto,
  ): Promise<RegulationCreateResult> => {
    const { data } = await apiClient.post<RegulationCreateResult>(
      REGULATIONS,
      payload,
    );
    return data;
  },

  /** S4 — PATCH /api/v1/regulations/:id. */
  updateRegulation: async (
    id: number,
    payload: UpdateRegulationDto,
  ): Promise<RegulationUpdateResult> => {
    const { data } = await apiClient.patch<RegulationUpdateResult>(
      `${REGULATIONS}/${id}`,
      payload,
    );
    return data;
  },

  /** S5 — DELETE /api/v1/regulations/:id (soft delete; T9 confirm at FE). */
  deleteRegulation: async (id: number): Promise<RegulationDeleteResult> => {
    const { data } = await apiClient.delete<RegulationDeleteResult>(
      `${REGULATIONS}/${id}`,
    );
    return data;
  },

  // ─── Regulatory Update ────────────────────────────────────────────────────

  /** S6 — GET /api/v1/regulatory-updates. */
  listRegulatoryUpdates: async (
    query: RegulatoryUpdateListQuery = {},
  ): Promise<RegulatoryUpdateListResponse> => {
    const { data } = await apiClient.get<RegulatoryUpdateListResponse>(
      REGULATORY_UPDATES,
      { params: toParams(query) },
    );
    return data;
  },

  /** S7 — GET /api/v1/regulatory-updates/:id. */
  getRegulatoryUpdateById: async (id: number): Promise<RegulatoryUpdate> => {
    const { data } = await apiClient.get<RegulatoryUpdate>(
      `${REGULATORY_UPDATES}/${id}`,
    );
    return data;
  },

  /** S8 — POST /api/v1/regulatory-updates. */
  createRegulatoryUpdate: async (
    payload: CreateRegulatoryUpdateDto,
  ): Promise<RegulatoryUpdateCreateResult> => {
    const { data } = await apiClient.post<RegulatoryUpdateCreateResult>(
      REGULATORY_UPDATES,
      payload,
    );
    return data;
  },

  /** S9 — PATCH /api/v1/regulatory-updates/:id. */
  updateRegulatoryUpdate: async (
    id: number,
    payload: UpdateRegulatoryUpdateDto,
  ): Promise<RegulatoryUpdateUpdateResult> => {
    const { data } = await apiClient.patch<RegulatoryUpdateUpdateResult>(
      `${REGULATORY_UPDATES}/${id}`,
      payload,
    );
    return data;
  },

  /** S10 — DELETE /api/v1/regulatory-updates/:id (cascades soft-deletes). */
  deleteRegulatoryUpdate: async (
    id: number,
  ): Promise<RegulatoryUpdateDeleteResult> => {
    const { data } = await apiClient.delete<RegulatoryUpdateDeleteResult>(
      `${REGULATORY_UPDATES}/${id}`,
    );
    return data;
  },

  // ─── Regulatory Impact ────────────────────────────────────────────────────

  /**
   * S11 — POST /api/v1/regulatory-impacts/bulk-detect.
   *
   * SENSITIVE — `impactPayload` (per-contract AI-generated content keyed by
   * contractId.toString()) flows through axios body only. Never console.log.
   * The BE pino redactor masks `impactPayload` + `ai_prompt_payload`.
   */
  bulkDetectRegulatoryImpacts: async (
    payload: BulkDetectRegulatoryImpactDto,
  ): Promise<BulkDetectRegulatoryImpactResult> => {
    const { data } = await apiClient.post<BulkDetectRegulatoryImpactResult>(
      `${REGULATORY_IMPACTS}/bulk-detect`,
      payload,
    );
    return data;
  },

  /** S12 — GET /api/v1/regulatory-impacts. */
  listRegulatoryImpacts: async (
    query: RegulatoryImpactListQuery = {},
  ): Promise<RegulatoryImpactListResponse> => {
    const { data } = await apiClient.get<RegulatoryImpactListResponse>(
      REGULATORY_IMPACTS,
      { params: toParams(query) },
    );
    return data;
  },

  /** S13 — PATCH /api/v1/regulatory-impacts/:id/resolve. */
  resolveRegulatoryImpact: async (
    id: number,
    payload: ResolveRegulatoryImpactDto,
  ): Promise<RegulatoryImpactResolveResult> => {
    const { data } = await apiClient.patch<RegulatoryImpactResolveResult>(
      `${REGULATORY_IMPACTS}/${id}/resolve`,
      payload,
    );
    return data;
  },

  // ─── Impact Category ──────────────────────────────────────────────────────

  /** S14 — GET /api/v1/impact-categories (no pagination — small reference table). */
  listImpactCategories: async (
    query: ImpactCategoryListQuery = {},
  ): Promise<ImpactCategoryListResponse> => {
    const { data } = await apiClient.get<ImpactCategoryListResponse>(
      IMPACT_CATEGORIES,
      { params: toParams(query) },
    );
    return data;
  },

  /**
   * S15 — POST /api/v1/impact-categories (UPSERT keyed on `key` in BODY).
   *
   * BE-OI-A NOTE: api-contracts.json specifies `POST` with `key` in the
   * body — NOT `PUT /:key`. The BE was implemented per the canonical
   * contract, so the FE must mirror that here. If a future spec wants the
   * key in the URL, escalate to Agent 5 for a contracts revision rather
   * than diverging here.
   */
  upsertImpactCategory: async (
    payload: UpsertImpactCategoryDto,
  ): Promise<ImpactCategoryUpsertResult> => {
    const { data } = await apiClient.post<ImpactCategoryUpsertResult>(
      IMPACT_CATEGORIES,
      payload,
    );
    return data;
  },
};

export type RegulatoryService = typeof regulatoryService;
