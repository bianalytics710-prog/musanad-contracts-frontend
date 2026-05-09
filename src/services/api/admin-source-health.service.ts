/**
 * Admin / OSINT source health API service. Wraps GET /api/v1/admin/source-health.
 *
 * Returns a bare array (no pagination) per S2-12 design exception — bounded
 * set per tenant (one row per (tenant_id, osint_source_id)).
 */
import { apiClient } from "@/lib/api-client";
import type { SourceHealthListItem } from "@/types/entities/osint.types";

export const adminSourceHealthService = {
  list: async (): Promise<SourceHealthListItem[]> => {
    const { data } = await apiClient.get<SourceHealthListItem[]>(
      "/api/v1/admin/source-health",
    );
    return data;
  },
};
