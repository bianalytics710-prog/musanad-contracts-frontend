/**
 * Musanad — M6 Dashboards & Reporting — API service.
 *
 * Thin axios wrappers over the 10 M6 endpoints (10/10 JWT). Paths derived
 * verbatim from .claude/workspace/current-module/api-contracts.json.
 *
 * Endpoint inventory:
 *   S1  GET /api/v1/dashboards/admin                              (also S13)
 *   S2  GET /api/v1/dashboards/drafter
 *   S3  GET /api/v1/dashboards/approver
 *   S4  GET /api/v1/dashboards/legal-counsel
 *   S5  GET /api/v1/dashboards/recipient
 *   S6  GET /api/v1/dashboards/router
 *   S7  GET /api/v1/dashboards/executive
 *   S8  GET /api/v1/dashboards/executive/anomalies-history
 *   S11 GET /api/v1/dashboards/ai-cost-summary
 *   S12 GET /api/v1/admin/health
 *
 * The api-client interceptor handles JWT, X-Request-ID, refresh-token
 * rotation, and ApiError normalisation. These methods only own the
 * request/response wire shapes.
 *
 * BE pass-through note (M6-BE-OI-1): controllers return the fn_ JSONB
 * directly (the inner `data` shape) rather than wrapping in
 * ApiResponse<T>. The FE consumes the inner shape directly.
 */

import { apiClient } from "@/lib/api-client";
import type {
  AdminDashboardSnapshot,
  AiCostSummary,
  ApproverDashboardSnapshot,
  DashboardRouterResponse,
  DashboardWindowQuery,
  DrafterDashboardSnapshot,
  ExecutiveAnomaliesHistoryQuery,
  ExecutiveAnomaliesHistoryResponse,
  ExecutiveDashboardSnapshot,
  HealthCheckSnapshot,
  LegalCounselDashboardSnapshot,
  RecipientDashboardSnapshot,
} from "@/types/entities/dashboards.types";

const BASE = "/api/v1";

export const dashboardsService = {
  // S1 — admin dashboard (also serves S13 admin landing tile grid)
  getAdminDashboard: async (
    query: DashboardWindowQuery = {},
  ): Promise<AdminDashboardSnapshot> => {
    const { data } = await apiClient.get<AdminDashboardSnapshot>(
      `${BASE}/dashboards/admin`,
      { params: query },
    );
    return data;
  },

  // S2 — drafter
  getDrafterDashboard: async (
    query: DashboardWindowQuery = {},
  ): Promise<DrafterDashboardSnapshot> => {
    const { data } = await apiClient.get<DrafterDashboardSnapshot>(
      `${BASE}/dashboards/drafter`,
      { params: query },
    );
    return data;
  },

  // S3 — approver
  getApproverDashboard: async (
    query: DashboardWindowQuery = {},
  ): Promise<ApproverDashboardSnapshot> => {
    const { data } = await apiClient.get<ApproverDashboardSnapshot>(
      `${BASE}/dashboards/approver`,
      { params: query },
    );
    return data;
  },

  // S4 — legal counsel
  getLegalCounselDashboard: async (
    query: DashboardWindowQuery = {},
  ): Promise<LegalCounselDashboardSnapshot> => {
    const { data } = await apiClient.get<LegalCounselDashboardSnapshot>(
      `${BASE}/dashboards/legal-counsel`,
      { params: query },
    );
    return data;
  },

  // S5 — recipient
  getRecipientDashboard: async (
    query: DashboardWindowQuery = {},
  ): Promise<RecipientDashboardSnapshot> => {
    const { data } = await apiClient.get<RecipientDashboardSnapshot>(
      `${BASE}/dashboards/recipient`,
      { params: query },
    );
    return data;
  },

  // S6 — router (no params)
  getRouter: async (): Promise<DashboardRouterResponse> => {
    const { data } = await apiClient.get<DashboardRouterResponse>(
      `${BASE}/dashboards/router`,
    );
    return data;
  },

  // S7 — executive (default windowDays=90, AI sub-call capped to 90)
  getExecutiveDashboard: async (
    query: DashboardWindowQuery = {},
  ): Promise<ExecutiveDashboardSnapshot> => {
    const { data } = await apiClient.get<ExecutiveDashboardSnapshot>(
      `${BASE}/dashboards/executive`,
      { params: query },
    );
    return data;
  },

  // S8 — executive anomalies history (default limit=10, max 50)
  getExecutiveAnomaliesHistory: async (
    query: ExecutiveAnomaliesHistoryQuery = {},
  ): Promise<ExecutiveAnomaliesHistoryResponse> => {
    const { data } = await apiClient.get<ExecutiveAnomaliesHistoryResponse>(
      `${BASE}/dashboards/executive/anomalies-history`,
      { params: query },
    );
    return data;
  },

  // S11 — AI cost summary (default windowDays=30, max 90 — matches M4 cap)
  getAiCostSummary: async (
    query: DashboardWindowQuery = {},
  ): Promise<AiCostSummary> => {
    const { data } = await apiClient.get<AiCostSummary>(
      `${BASE}/dashboards/ai-cost-summary`,
      { params: query },
    );
    return data;
  },

  // S12 — admin health (no params, JWT + role-gated)
  getAdminHealth: async (): Promise<HealthCheckSnapshot> => {
    const { data } = await apiClient.get<HealthCheckSnapshot>(
      `${BASE}/admin/health`,
    );
    return data;
  },
};

export type DashboardsService = typeof dashboardsService;
