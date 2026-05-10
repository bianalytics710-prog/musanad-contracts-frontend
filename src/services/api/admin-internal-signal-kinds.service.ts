/**
 * Admin / internal-signal-kinds API service. Wraps
 * `GET /api/v1/admin/internal-signal-kinds` (M8 / CR-A2).
 *
 * Returns a bare array (no pagination) — bounded set of 8 catalogue rows per
 * tenant, mirrors the M7 admin-source-health.service.ts pattern.
 *
 * Per R-PA7 lesson A7: the apiClient call is encapsulated here so pages,
 * features, components, and hooks NEVER import apiClient directly.
 */
import { apiClient } from "@/lib/api-client";
import type { InternalSignalKind } from "@/types/entities/internal-signal.types";

export const adminInternalSignalKindsService = {
  list: async (): Promise<InternalSignalKind[]> => {
    const { data } = await apiClient.get<InternalSignalKind[]>(
      "/api/v1/admin/internal-signal-kinds",
    );
    return data;
  },
};
