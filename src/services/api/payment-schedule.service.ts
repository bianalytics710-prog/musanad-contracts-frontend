/**
 * Musanad — Payment Schedule API service (M1b).
 *
 * Two M1b endpoints (S2 list, S3 bulk replace) wrapping
 * /api/v1/contracts/:id/payment-schedules. The export endpoints (S4 PDF,
 * S5 XLSX) live in `contract-export.service.ts` because they return
 * binary streams, not JSON, and the path shapes diverge.
 *
 * Follows the M1a contracts.service.ts pattern: thin axios wrappers; the
 * api-client interceptor handles JWT, X-Request-ID, refresh-token rotation,
 * and ApiError normalisation.
 *
 * Filename note: api-contracts.json calls this `payment-schedule.service.ts`
 * (singular path noun, plural URL) per CLAUDE.md §7 naming rule. The fn_
 * is `fn_payment_schedule_list` (singular).
 */

import { apiClient } from "@/lib/api-client";
import type {
  PaymentScheduleListQuery,
  PaymentScheduleListResponse,
  PaymentScheduleBulkReplaceDto,
  PaymentScheduleBulkReplaceResponse,
} from "@/types/entities/payment-schedule.types";

const BASE = "/api/v1/contracts";

/**
 * Strip undefined / empty-string values from a query object. Mirrors the
 * helper in contracts.service.ts so axios doesn't serialise `?status=` for
 * absent filters.
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

export const paymentScheduleService = {
  /**
   * S2 — GET /api/v1/contracts/:id/payment-schedules
   * Returns the active milestone schedule for a contract, ordered by
   * dueDate ASC NULLS LAST then id ASC. Not paginated (rows per contract
   * are typically 1..30).
   */
  list: async (
    contractId: number,
    query: PaymentScheduleListQuery = {},
  ): Promise<PaymentScheduleListResponse> => {
    const { data } = await apiClient.get<PaymentScheduleListResponse>(
      `${BASE}/${contractId}/payment-schedules`,
      { params: toParams(query) },
    );
    return data;
  },

  /**
   * S3 — PUT /api/v1/contracts/:id/payment-schedules
   * Atomic bulk replace: soft-deletes existing active rows then inserts the
   * new set in a single transaction. The Compose Wizard (S1) calls this
   * after fn_contract_create returns the new contract id, with replaceExisting=true.
   */
  bulkReplace: async (
    contractId: number,
    payload: PaymentScheduleBulkReplaceDto,
  ): Promise<PaymentScheduleBulkReplaceResponse> => {
    const { data } = await apiClient.put<PaymentScheduleBulkReplaceResponse>(
      `${BASE}/${contractId}/payment-schedules`,
      payload,
    );
    return data;
  },
};

export default paymentScheduleService;
