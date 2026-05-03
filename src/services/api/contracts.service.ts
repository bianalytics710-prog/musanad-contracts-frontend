/**
 * Musanad — Contracts API service (M1a).
 *
 * Thin axios wrappers over /api/v1/contracts*. Paths and shapes derived
 * directly from .claude/workspace/current-module/api-contracts.json.
 *
 * 11 endpoints across 11 stories (S12 is system-only).
 *
 * The api-client interceptor handles JWT, X-Request-ID, refresh-token
 * rotation, and error normalisation (ApiError). These methods only own
 * the request/response wire shapes.
 *
 * Sensitive fields (bodyEn / bodyAr) appear in payloads but MUST NOT be
 * console.logged or persisted in plaintext anywhere outside transient
 * memory (T13). Pino redaction handles BE side.
 */

import { apiClient } from "@/lib/api-client";
import type {
  // Read shapes
  Contract,
  ContractListResponse,
  ContractTreeResponse,
  ContractVersionListResponse,
  ContractActivityListResponse,
  // Write request DTOs
  CreateContractDto,
  UpdateContractDto,
  UpdateContractStatusDto,
  SetContractTagsDto,
  CreateContractVersionDto,
  // Write response DTOs
  CreateContractResponse,
  UpdateContractResponse,
  DeleteContractResponse,
  UpdateContractStatusResponse,
  SetContractTagsResponse,
  CreateContractVersionResponse,
  // Query types
  ContractListQuery,
  ContractVersionListQuery,
  ContractActivityListQuery,
} from "@/types/entities/contract.types";

const BASE = "/api/v1/contracts";

/**
 * Convert a query object into Axios `params` form. Strips undefined and
 * empty-string values; passes string[] through unchanged so Axios can
 * serialise as `tags=a&tags=b`.
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

export const contractsService = {
  // S1 — GET /api/v1/contracts
  list: async (query: ContractListQuery = {}): Promise<ContractListResponse> => {
    const { data } = await apiClient.get<ContractListResponse>(BASE, {
      params: toParams(query),
    });
    return data;
  },

  // S2 — GET /api/v1/contracts/:id
  getById: async (id: number): Promise<Contract> => {
    const { data } = await apiClient.get<Contract>(`${BASE}/${id}`);
    return data;
  },

  // S3 — POST /api/v1/contracts
  create: async (payload: CreateContractDto): Promise<CreateContractResponse> => {
    const { data } = await apiClient.post<CreateContractResponse>(BASE, payload);
    return data;
  },

  // S4 — PUT /api/v1/contracts/:id
  update: async (id: number, payload: UpdateContractDto): Promise<UpdateContractResponse> => {
    const { data } = await apiClient.put<UpdateContractResponse>(`${BASE}/${id}`, payload);
    return data;
  },

  // S5 — DELETE /api/v1/contracts/:id
  remove: async (id: number): Promise<DeleteContractResponse> => {
    const { data } = await apiClient.delete<DeleteContractResponse>(`${BASE}/${id}`);
    return data;
  },

  // S6 — PATCH /api/v1/contracts/:id/status
  updateStatus: async (
    id: number,
    payload: UpdateContractStatusDto,
  ): Promise<UpdateContractStatusResponse> => {
    const { data } = await apiClient.patch<UpdateContractStatusResponse>(
      `${BASE}/${id}/status`,
      payload,
    );
    return data;
  },

  // S7 — GET /api/v1/contracts/:id/tree
  getTree: async (id: number): Promise<ContractTreeResponse> => {
    const { data } = await apiClient.get<ContractTreeResponse>(`${BASE}/${id}/tree`);
    return data;
  },

  // S8 — PUT /api/v1/contracts/:id/tags
  setTags: async (id: number, payload: SetContractTagsDto): Promise<SetContractTagsResponse> => {
    const { data } = await apiClient.put<SetContractTagsResponse>(`${BASE}/${id}/tags`, payload);
    return data;
  },

  // S9 — GET /api/v1/contracts/:id/versions
  listVersions: async (
    id: number,
    query: ContractVersionListQuery = {},
  ): Promise<ContractVersionListResponse> => {
    const { data } = await apiClient.get<ContractVersionListResponse>(`${BASE}/${id}/versions`, {
      params: toParams(query),
    });
    return data;
  },

  // S10 — POST /api/v1/contracts/:id/versions
  createVersion: async (
    id: number,
    payload: CreateContractVersionDto,
  ): Promise<CreateContractVersionResponse> => {
    const { data } = await apiClient.post<CreateContractVersionResponse>(
      `${BASE}/${id}/versions`,
      payload,
    );
    return data;
  },

  // S11 — GET /api/v1/contracts/:id/activity
  listActivity: async (
    id: number,
    query: ContractActivityListQuery = {},
  ): Promise<ContractActivityListResponse> => {
    const { data } = await apiClient.get<ContractActivityListResponse>(`${BASE}/${id}/activity`, {
      params: toParams(query),
    });
    return data;
  },
};

export default contractsService;
