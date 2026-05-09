/**
 * Signals API service. Wraps GET /api/v1/signals (OSINT normalised signals).
 *
 * CR-A scope: lightweight wrapper for downstream CR-G dashboards. Not
 * surfaced in any FE view in CR-A itself.
 */
import { apiClient } from "@/lib/api-client";
import type {
  OsintSignalListFilter,
  OsintSignalListResponse,
} from "@/types/entities/osint.types";

export interface ListSignalsParams extends OsintSignalListFilter {
  page?: number;
  limit?: number;
}

export const signalsService = {
  list: async (
    params: ListSignalsParams = {},
  ): Promise<OsintSignalListResponse> => {
    const { data } = await apiClient.get<OsintSignalListResponse>(
      "/api/v1/signals",
      { params },
    );
    return data;
  },
};
