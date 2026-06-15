/**
 * Phase A (mig 640) — My Work unified inbox API service.
 *
 * Wraps GET /api/v1/my-work. Returns the same envelope shape as
 * /api/v1/work-orders so the existing MyWorkInbox table can render rows from
 * either source. The only new field is `actionUrl` — for synthesized rows
 * (approvals, risk cases, advisory, tpa) the inbox uses this to navigate
 * directly to the source page rather than the work-order-detail view.
 */

import { apiClient } from "@/lib/api-client";
import type { WorkOrderRow, WorkOrderListResponse } from "./work-orders.service";

const BASE = "/api/v1/my-work";

export const MY_WORK_TYPES = [
  "contract_draft_request",
  "contract_returned",
  "comment_response",
  "approval_awaiting",
  "risk_case_assigned",
  "third_party_review",
  "advisory_draft",
  // mig 657 — gaps 4 + 5
  "comment_mention",
  "signature_required",
] as const;

export type MyWorkType = (typeof MY_WORK_TYPES)[number];

/**
 * Same shape as WorkOrderRow plus actionUrl, but with a widened workOrderType
 * union so the four new synthesized types (approval_awaiting / risk_case_
 * assigned / third_party_review / advisory_draft) are first-class. For
 * synthesized rows the row.id is a negative integer (per source offset, see
 * mig 640) — the FE uses it only as a React key; navigation goes via
 * actionUrl.
 */
export interface MyWorkRow extends Omit<WorkOrderRow, "workOrderType"> {
  workOrderType: MyWorkType;
  actionUrl: string;
}

export interface MyWorkListResponse extends Omit<WorkOrderListResponse, "data"> {
  data: MyWorkRow[];
}

export interface ListMyWorkQuery {
  status?: Array<"open" | "in_progress" | "completed" | "cancelled">;
  type?: MyWorkType[];
  search?: string;
  limit?: number;
  page?: number;
}

// mig 684 — personal work-status overlay.
export const PERSONAL_WORK_STATUSES = [
  "to_do",
  "in_progress",
  "done",
  "blocked",
] as const;
export type PersonalWorkStatus = (typeof PERSONAL_WORK_STATUSES)[number];
export interface MyWorkStatusEntry {
  workItemId: number;
  status: PersonalWorkStatus;
}

export const myWorkKeys = {
  all: ["myWork"] as const,
  list: (q: ListMyWorkQuery) => ["myWork", "list", q] as const,
  statuses: ["myWork", "statuses"] as const,
};

export const myWorkService = {
  list: async (q: ListMyWorkQuery = {}): Promise<MyWorkListResponse> => {
    const params: Record<string, string> = {};
    if (q.status?.length) params.status = q.status.join(",");
    if (q.type?.length) params.type = q.type.join(",");
    if (q.search) params.search = q.search;
    if (q.limit != null) params.limit = String(q.limit);
    if (q.page != null) params.page = String(q.page);
    const { data } = await apiClient.get<MyWorkListResponse>(BASE, { params });
    return data;
  },

  // mig 684 — the actor's personal status overlay as [{workItemId,status}].
  listStatuses: async (): Promise<MyWorkStatusEntry[]> => {
    const { data } = await apiClient.get<{ data: MyWorkStatusEntry[] }>(
      `${BASE}/statuses`,
    );
    return data.data;
  },

  // mig 684 — upsert the actor's personal status for one row.
  setStatus: async (
    workItemId: number,
    status: PersonalWorkStatus,
  ): Promise<MyWorkStatusEntry> => {
    const { data } = await apiClient.post<MyWorkStatusEntry>(`${BASE}/status`, {
      workItemId,
      status,
    });
    return data;
  },
};
