/**
 * Admin / audit API service. Wraps /api/v1/admin/audit.
 */
import { apiClient } from "@/lib/api-client";

export interface AuditChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface AuditLogRow {
  id: number;
  tableName: string;
  recordId: number | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  changedBy: number | null;
  changedByName: string | null;
  changedByEmail: string | null;
  changedAt: string;
  contractId: number | null;
  contractNumber: string | null;
  changes: AuditChange[];
  oldValues: unknown;
  newValues: unknown;
}

export interface AuditLogListResponse {
  data: AuditLogRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  tableName?: string;
  action?: "INSERT" | "UPDATE" | "DELETE";
  changedBy?: number;
  dateFrom?: string;
  dateTo?: string;
  contractId?: number;
}

export const adminAuditService = {
  list: async (query: AuditLogQuery = {}): Promise<AuditLogListResponse> => {
    const { data } = await apiClient.get<AuditLogListResponse>(
      "/api/v1/admin/audit",
      { params: query },
    );
    return data;
  },

  exportUrl: (query: AuditLogQuery = {}): string => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    }
    const qs = sp.toString();
    return `/api/v1/admin/audit/export${qs ? "?" + qs : ""}`;
  },

  downloadCsv: async (query: AuditLogQuery = {}): Promise<Blob> => {
    const url = adminAuditService.exportUrl(query);
    const response = await apiClient.get<Blob>(url, { responseType: "blob" });
    return response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: "text/csv;charset=utf-8" });
  },
};
