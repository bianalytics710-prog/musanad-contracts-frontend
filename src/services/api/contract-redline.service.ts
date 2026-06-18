/**
 * Counterparty redline import API client (Scenario 2, mig 710).
 *
 *   POST   /contracts/:id/redline-imports                          upload + diff
 *   GET    /contracts/:id/redline-imports                          list
 *   GET    /contracts/:id/redline-imports/:importId                detail + changes
 *   PATCH  /contracts/:id/redline-imports/:importId/changes/:cid   accept/reject
 *   POST   /contracts/:id/redline-imports/:importId/apply          → new version
 */
import { apiClient } from "@/lib/api-client";

export type RedlineChangeType = "added" | "removed" | "modified";
export type RedlineDecision = "pending" | "accepted" | "rejected";

export interface RedlineChange {
  id: number;
  seq: number;
  clauseId: string | null;
  clauseHeading: string | null;
  changeType: RedlineChangeType;
  ourText: string | null;
  theirText: string | null;
  decision: RedlineDecision;
  decidedAt: string | null;
}

export interface RedlineImportCounts {
  total: number;
  added: number;
  removed: number;
  modified: number;
}

export interface RedlineImport {
  id: number;
  contractId: number;
  contractNumber: string;
  baseVersionNumber: number;
  currentVersion: number;
  filename: string;
  engine: string | null;
  status: "review" | "applied" | "discarded";
  counts: RedlineImportCounts;
  appliedVersionNumber: number | null;
  createdAt: string;
  changes: RedlineChange[];
}

export interface RedlineImportListItem {
  id: number;
  filename: string;
  status: "review" | "applied" | "discarded";
  baseVersionNumber: number;
  appliedVersionNumber: number | null;
  counts: RedlineImportCounts;
  createdAt: string;
}

export const contractRedlineService = {
  upload: async (contractId: number, file: File): Promise<RedlineImport> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<RedlineImport>(
      `/api/v1/contracts/${contractId}/redline-imports`,
      form,
      { headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000 },
    );
    return data;
  },

  list: async (contractId: number): Promise<RedlineImportListItem[]> => {
    const { data } = await apiClient.get<{ data: RedlineImportListItem[] | null }>(
      `/api/v1/contracts/${contractId}/redline-imports`,
    );
    return data.data ?? [];
  },

  get: async (contractId: number, importId: number): Promise<RedlineImport> => {
    const { data } = await apiClient.get<RedlineImport>(
      `/api/v1/contracts/${contractId}/redline-imports/${importId}`,
    );
    return data;
  },

  decide: async (
    contractId: number,
    importId: number,
    changeId: number,
    decision: RedlineDecision,
  ): Promise<{ id: number; decision: RedlineDecision }> => {
    const { data } = await apiClient.patch(
      `/api/v1/contracts/${contractId}/redline-imports/${importId}/changes/${changeId}`,
      { decision },
    );
    return data;
  },

  apply: async (
    contractId: number,
    importId: number,
  ): Promise<{ versionNumber: number; appliedChanges: number }> => {
    const { data } = await apiClient.post(
      `/api/v1/contracts/${contractId}/redline-imports/${importId}/apply`,
      {},
    );
    return data;
  },
};
