/**
 * Internal Systems admin service — Platform Admin registry of internal
 * integrations (ERP / Finance / HRMS / CRM / etc.).
 *
 *   GET    /api/v1/admin/internal-systems
 *   POST   /api/v1/admin/internal-systems
 *   GET    /api/v1/admin/internal-systems/:id
 *   PUT    /api/v1/admin/internal-systems/:id
 *   DELETE /api/v1/admin/internal-systems/:id
 *   POST   /api/v1/admin/internal-systems/:id/test-connection
 *
 * All endpoints require platform.integrations.manage (granted to Super Admin
 * + platform_admin via mig 578).
 */
import { apiClient } from "@/lib/api-client";

export type InternalSystemKind =
  | "erp"
  | "finance"
  | "hrms"
  | "crm"
  | "itsm"
  | "dms"
  | "scm"
  | "data_warehouse"
  | "custom";

export type InternalSystemStatus =
  | "untested"
  | "healthy"
  | "degraded"
  | "failing"
  | "unauthorised";

export type AuthMethod =
  | "none"
  | "oauth2"
  | "api_key"
  | "basic"
  | "saml"
  | "certificate";

export interface InternalSystemRow {
  id: number;
  systemCode: string;
  displayName: string;
  displayNameAr: string | null;
  kind: InternalSystemKind;
  vendor: string | null;
  baseUrl: string | null;
  apiEndpoint: string | null;
  authMethod: AuthMethod;
  pullScheduleCron: string | null;
  lastPullAt: string | null;
  lastStatus: InternalSystemStatus;
  lastStatusAt: string | null;
  lastError: string | null;
  notes: string | null;
  dataClassification: "demo" | "pilot" | "production";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InternalSystemInput {
  systemCode: string;
  displayName: string;
  displayNameAr?: string | null;
  kind: InternalSystemKind;
  vendor?: string | null;
  baseUrl?: string | null;
  apiEndpoint?: string | null;
  authMethod?: AuthMethod;
  pullScheduleCron?: string | null;
  notes?: string | null;
}

interface Envelope<T> {
  data: T;
  total?: number;
}

export interface TestConnectionResult {
  id: number;
  lastStatus: InternalSystemStatus;
  probe: {
    status: InternalSystemStatus;
    httpStatus: number | null;
    durationMs: number;
    error: string | null;
  };
}

export const adminInternalSystemsService = {
  list: async (params: {
    kind?: InternalSystemKind;
    status?: InternalSystemStatus;
    search?: string;
  } = {}): Promise<InternalSystemRow[]> => {
    const r = await apiClient.get<Envelope<InternalSystemRow[] | null>>(
      "/api/v1/admin/internal-systems",
      { params },
    );
    return r.data.data ?? [];
  },

  get: async (id: number): Promise<InternalSystemRow> => {
    const r = await apiClient.get<InternalSystemRow>(
      `/api/v1/admin/internal-systems/${id}`,
    );
    return r.data;
  },

  create: async (input: InternalSystemInput): Promise<InternalSystemRow> => {
    const r = await apiClient.post<InternalSystemRow>(
      "/api/v1/admin/internal-systems",
      input,
    );
    return r.data;
  },

  update: async (
    id: number,
    input: InternalSystemInput,
  ): Promise<InternalSystemRow> => {
    const r = await apiClient.put<InternalSystemRow>(
      `/api/v1/admin/internal-systems/${id}`,
      input,
    );
    return r.data;
  },

  deactivate: async (id: number): Promise<{ id: number; isActive: boolean }> => {
    const r = await apiClient.delete<{ id: number; isActive: boolean }>(
      `/api/v1/admin/internal-systems/${id}`,
    );
    return r.data;
  },

  testConnection: async (id: number): Promise<TestConnectionResult> => {
    const r = await apiClient.post<TestConnectionResult>(
      `/api/v1/admin/internal-systems/${id}/test-connection`,
      {},
      { timeout: 15_000 },
    );
    return r.data;
  },
};
