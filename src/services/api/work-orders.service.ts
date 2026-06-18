/**
 * Musanad — Work Orders API service (M21).
 *
 * Thin wrappers over /api/v1/work-orders/*. The api-client interceptor
 * handles JWT + 401-refresh + ApiError normalisation.
 */

import { apiClient } from "@/lib/api-client";

const BASE = "/api/v1/work-orders";

export type WorkOrderType =
  | "contract_draft_request"
  | "contract_returned"
  | "comment_response"
  | "redline_approver_tag";

export type WorkOrderStatus = "open" | "in_progress" | "completed" | "cancelled";

/** M21 mig 631 — Drafter-set Stage override values. */
export type ManualStageValue =
  | "not_started"
  | "draft_in_progress"
  | "awaiting_approval"
  | "returned"
  | "completed";

export interface WorkOrderRow {
  id: number;
  workOrderType: WorkOrderType;
  status: WorkOrderStatus;
  priority: "low" | "normal" | "high" | "urgent";
  sourceContractId: number | null;
  sourceContractNumber: string | null;
  sourceContractTitleEn: string | null;
  sourceContractTitleAr: string | null;
  targetContractId: number | null;
  targetContractNumber: string | null;
  targetContractTitleEn: string | null;
  targetContractTitleAr: string | null;
  targetContractStatus: string | null;
  counterpartyName: string | null;
  assignedByUserId: number | null;
  assignedByName: string | null;
  payload: Record<string, unknown>;
  relatedCommentId: number | null;
  /** M21 mig 631 — when set, FE uses this instead of the derived stage. */
  manualStage: ManualStageValue | null;
  createdAt: string;
  completedAt: string | null;
  dueAt: string | null;
  ageDays: number;
}

export interface WorkOrderListResponse {
  data: WorkOrderRow[];
  totalCount: number;
  openCount: number;
  /** M21 mig 632 — pagination envelope. Optional for back-compat with older BE. */
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

/**
 * M21 mig 638 — Executive "Assigned Work" row. Mirror of WorkOrderRow with
 * assignedToName (the owner) added. assignedByName is still present so the
 * row carries enough context for an audit chip ("by you" — rendered at the
 * caller's discretion).
 */
export interface AssignedByMeRow extends WorkOrderRow {
  assignedToUserId: number | null;
  assignedToName: string | null;
}

export interface AssignedByMeListResponse {
  data: AssignedByMeRow[];
  totalCount: number;
  openCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListAssignedByMeQuery {
  status?: WorkOrderStatus[];
  type?: WorkOrderType[];
  ownerId?: number;
  limit?: number;
  page?: number;
}

export interface OwnerOption {
  id: number;
  label: string;
  email: string;
  roleName: string;
}

export interface OwnerOptionsResponse {
  options: OwnerOption[];
}

export interface NudgeResponse {
  workOrderId: number;
  throttled: boolean;
  nudgedAt?: string;
  lastNudgedAt?: string;
  nextEligibleAt?: string;
  assigneeName?: string;
}

export interface ReassignResponse {
  workOrderId: number;
  newAssignee: { id: number; name: string };
  previousAssigneeId: number | null;
}

export interface AssignableDrafter {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  openWorkOrders: number;
}

export interface AssignableDraftersResponse {
  data: { data: AssignableDrafter[] };
}

export interface CreateDraftRequestPayload {
  sourceContractId: number;
  assignedDrafterId: number;
  /** Existing party from the dropdown. */
  counterpartyId?: number | null;
  /** Free-text new prospect name when no existing party fits. */
  counterpartyProspectName?: string | null;
  instructionNote?: string | null;
  valueAed?: number | null;
  priority?: "low" | "normal" | "high" | "urgent";
}

export interface CreateDraftRequestResponse {
  workOrderId: number;
  sourceContractId: number;
  sourceContractNumber: string;
  counterpartyName: string | null;
  assignedDrafter: { id: number; name: string };
}

/** M21 2026-06-12 v2 — manual "Add to my queue" payload (mig 630 shape).
 *  Drafter is BE-side self-assigned; requestor is who asked for the work. */
export type ManualInitialStage = "not_started" | "in_progress" | "completed";

export interface CreateManualWorkOrderPayload {
  requestType: WorkOrderType;
  instructionNote: string;
  requestorUserId: number;
  initialStage?: ManualInitialStage;
  /** M21 mig 631 — optional contract id when drafter confirmed a "Similar contract" match. */
  sourceContractId?: number | null;
}

/** M21 mig 631 — Similar contract lookup result. */
export interface ContractLookupResponse {
  found: boolean;
  id?: number;
  contractNumber?: string;
  titleEn?: string | null;
  titleAr?: string | null;
  contractType?: string;
  counterpartyName?: string | null;
}

export interface CreateManualWorkOrderResponse {
  workOrderId: number;
  requestType: WorkOrderType;
  requestorUserId: number;
  initialStage: ManualInitialStage;
  source: "manual";
}

export interface RequestorOption {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
}

export interface RequestorOptionsResponse {
  items: RequestorOption[];
}

export interface ExtractedPlaceholder {
  key: string;
  labelEn: string;
  labelAr?: string | null;
  kind: "party" | "date" | "currency" | "number" | "text";
  required?: boolean;
  defaultValue?: string | null;
}

export interface ExtractFromSourceResponse {
  sourceContractId: number;
  sourceContractNumber: string;
  sourceTitleEn: string | null;
  sourceTitleAr: string | null;
  sourceContractType: string;
  contractType: string;
  language: "en" | "ar" | "bilingual";
  bodyEnRedacted: string;
  placeholders: ExtractedPlaceholder[];
  warnings: string[];
}

export interface ListMineQuery {
  status?: WorkOrderStatus[];
  type?: WorkOrderType[];
  limit?: number;
  /** M21 mig 632 — 1-indexed page number. */
  page?: number;
}

/**
 * M21 — sidecar progress row. One entry per work order whose target contract
 * has an in-progress approval chain. `currentApproverNames` is what the FE
 * Stage column renders as "Awaiting Legal Counsel + Contract Approver".
 */
export interface WorkOrderProgressRow {
  workOrderId: number;
  currentApproverNames: string[];
}

export interface WorkOrderProgressResponse {
  items: WorkOrderProgressRow[];
}

function toParams(q: ListMineQuery | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!q) return out;
  if (q.status?.length) out.status = q.status.join(",");
  if (q.type?.length) out.type = q.type.join(",");
  if (q.limit) out.limit = q.limit;
  if (q.page) out.page = q.page;
  return out;
}

export const workOrdersService = {
  /** GET /api/v1/work-orders — list mine */
  listMine: async (query: ListMineQuery = {}): Promise<WorkOrderListResponse> => {
    const { data } = await apiClient.get<WorkOrderListResponse>(BASE, {
      params: toParams(query),
    });
    return data;
  },

  /** GET /api/v1/work-orders/progress — M21 sidecar: per-row approver names for Stage column */
  progress: async (): Promise<WorkOrderProgressResponse> => {
    const { data } = await apiClient.get<WorkOrderProgressResponse>(`${BASE}/progress`);
    return data;
  },

  /** GET /api/v1/work-orders/counterparty-options — parties dropdown for exec modal */
  counterpartyOptions: async (): Promise<Array<{ id: number; nameEn: string; partyType: string | null }>> => {
    const { data } = await apiClient.get<{ data: Array<{ id: number; nameEn: string; partyType: string | null }> }>(
      `${BASE}/counterparty-options`,
    );
    return data.data;
  },

  /** GET /api/v1/work-orders/assignable-drafters — for exec modal dropdown */
  assignableDrafters: async (): Promise<AssignableDrafter[]> => {
    const { data } = await apiClient.get<{ data: AssignableDrafter[] }>(
      `${BASE}/assignable-drafters`,
    );
    return data.data;
  },

  /** GET /api/v1/work-orders/:id — single */
  getById: async (id: number): Promise<WorkOrderRow> => {
    const { data } = await apiClient.get<WorkOrderRow>(`${BASE}/${id}`);
    return data;
  },

  /** GET /api/v1/work-orders/requestor-options — list active users for the modal's Requestor dropdown */
  requestorOptions: async (): Promise<RequestorOptionsResponse> => {
    const { data } = await apiClient.get<RequestorOptionsResponse>(
      `${BASE}/requestor-options`,
    );
    return data;
  },

  /** POST /api/v1/work-orders/manual — drafter self-adds a manual queue entry (M21 2026-06-12) */
  createManual: async (
    payload: CreateManualWorkOrderPayload,
  ): Promise<CreateManualWorkOrderResponse> => {
    const { data } = await apiClient.post<CreateManualWorkOrderResponse>(
      `${BASE}/manual`,
      payload,
    );
    return data;
  },

  /** GET /api/v1/work-orders/lookup-contract?number=… — M21 mig 631 — similar contract lookup */
  lookupContract: async (contractNumber: string): Promise<ContractLookupResponse> => {
    const { data } = await apiClient.get<ContractLookupResponse>(
      `${BASE}/lookup-contract`,
      { params: { number: contractNumber } },
    );
    return data;
  },

  /** PATCH /api/v1/work-orders/:id/stage — M21 mig 631 — drafter Stage override */
  setStage: async (
    workOrderId: number,
    stage: ManualStageValue | null,
  ): Promise<{ workOrderId: number; manualStage: ManualStageValue | null }> => {
    const { data } = await apiClient.patch<{ workOrderId: number; manualStage: ManualStageValue | null }>(
      `${BASE}/${workOrderId}/stage`,
      { stage },
    );
    return data;
  },

  /** POST /api/v1/work-orders/from-contract — exec creates the work order (no contract yet) */
  createDraftRequest: async (
    payload: CreateDraftRequestPayload,
  ): Promise<CreateDraftRequestResponse> => {
    const { data } = await apiClient.post<CreateDraftRequestResponse>(
      `${BASE}/from-contract`,
      payload,
    );
    return data;
  },

  /** POST /api/v1/work-orders/extract-from-source — AI redaction + placeholders for the compose seeding.
   *  90s timeout override — the gpt-4o-mini extraction can take 30–60s on a full MSA body. */
  extractFromSource: async (sourceContractId: number): Promise<ExtractFromSourceResponse> => {
    const { data } = await apiClient.post<ExtractFromSourceResponse>(
      `${BASE}/extract-from-source`,
      { sourceContractId },
      { timeout: 90_000 },
    );
    return data;
  },

  /** POST /api/v1/work-orders/:id/link-target — drafter links the new contract to the work order on submit */
  linkTarget: async (
    workOrderId: number,
    contractId: number,
  ): Promise<{ id: number; targetContractId: number; status: string }> => {
    const { data } = await apiClient.post<{ id: number; targetContractId: number; status: string }>(
      `${BASE}/${workOrderId}/link-target`,
      { contractId },
    );
    return data;
  },

  /** POST /api/v1/work-orders/:id/complete */
  complete: async (id: number): Promise<{ id: number; status: string }> => {
    const { data } = await apiClient.post<{ id: number; status: string }>(
      `${BASE}/${id}/complete`,
    );
    return data;
  },

  /** POST /api/v1/work-orders/:id/cancel */
  cancel: async (
    id: number,
    reason?: string,
  ): Promise<{ id: number; status: string }> => {
    const { data } = await apiClient.post<{ id: number; status: string }>(
      `${BASE}/${id}/cancel`,
      { reason: reason ?? null },
    );
    return data;
  },

  // ───── M21 mig 638/639 — Executive "Assigned Work" surface ──────────

  /** GET /api/v1/work-orders/assigned-by-me — exec list */
  listAssignedByMe: async (
    query: ListAssignedByMeQuery = {},
  ): Promise<AssignedByMeListResponse> => {
    const params: Record<string, unknown> = {};
    if (query.status?.length) params.status = query.status.join(",");
    if (query.type?.length) params.type = query.type.join(",");
    if (query.ownerId) params.ownerId = query.ownerId;
    if (query.limit) params.limit = query.limit;
    if (query.page) params.page = query.page;
    const { data } = await apiClient.get<AssignedByMeListResponse>(
      `${BASE}/assigned-by-me`,
      { params },
    );
    return data;
  },

  /** GET /api/v1/work-orders/owner-options — OWNER dropdown source */
  ownerOptions: async (): Promise<OwnerOption[]> => {
    const { data } = await apiClient.get<OwnerOptionsResponse>(
      `${BASE}/owner-options`,
    );
    return data.options;
  },

  /** POST /api/v1/work-orders/:id/nudge — exec reminder to owner */
  nudge: async (id: number, message?: string): Promise<NudgeResponse> => {
    const { data } = await apiClient.post<NudgeResponse>(`${BASE}/${id}/nudge`, {
      message: message ?? null,
    });
    return data;
  },

  /** POST /api/v1/work-orders/:id/reassign — move to a new owner */
  reassign: async (
    id: number,
    newAssigneeId: number,
    reason?: string,
  ): Promise<ReassignResponse> => {
    const { data } = await apiClient.post<ReassignResponse>(
      `${BASE}/${id}/reassign`,
      { newAssigneeId, reason: reason ?? null },
    );
    return data;
  },
};

export const workOrderKeys = {
  all: ["workOrders"] as const,
  list: (q: ListMineQuery) => [...workOrderKeys.all, "list", q] as const,
  lists: () => [...workOrderKeys.all, "list"] as const,
  detail: (id: number) => [...workOrderKeys.all, "detail", id] as const,
  assignableDrafters: () => [...workOrderKeys.all, "drafters"] as const,
  progress: () => [...workOrderKeys.all, "progress"] as const,
  // M21 mig 638 — exec scope.
  assignedByMe: (q: ListAssignedByMeQuery) =>
    [...workOrderKeys.all, "assignedByMe", q] as const,
  ownerOptions: () => [...workOrderKeys.all, "ownerOptions"] as const,
};
