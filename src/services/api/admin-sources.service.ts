/**
 * Admin / OSINT sources API service. Wraps /api/v1/admin/sources endpoints
 * (list / get / create / update / delete / test-pull / credential-set).
 *
 * Per R-PA7 lesson A7: the apiClient call is encapsulated here so pages /
 * components / hooks never import apiClient directly.
 */
import { apiClient } from "@/lib/api-client";
import type {
  CreateOsintSourceDto,
  DeleteOsintSourceResponse,
  OsintSourceDetail,
  OsintSourceListFilter,
  OsintSourceListResponse,
  SetCredentialDto,
  SetCredentialResponse,
  TestPullResponse,
  UpdateOsintSourceDto,
} from "@/types/entities/osint.types";

export interface ListSourcesParams extends OsintSourceListFilter {
  page?: number;
  limit?: number;
}

/** Result of POST /admin/sources/pull-now (full on-demand sweep). */
export interface PullNowResult {
  candidates: number;
  processed: number;
  inserted: number;
  errors: number;
}

/** Result of POST /admin/sources/:id/pull (single-source on-demand fetch). */
export interface PullSourceResult {
  found: boolean;
  sourceId?: string;
  inserted: number;
  total: number;
}

export const adminSourcesService = {
  list: async (
    params: ListSourcesParams = {},
  ): Promise<OsintSourceListResponse> => {
    const { data } = await apiClient.get<OsintSourceListResponse>(
      "/api/v1/admin/sources",
      { params },
    );
    return data;
  },

  getById: async (id: number): Promise<OsintSourceDetail> => {
    const { data } = await apiClient.get<OsintSourceDetail>(
      `/api/v1/admin/sources/${id}`,
    );
    return data;
  },

  create: async (
    payload: CreateOsintSourceDto,
  ): Promise<OsintSourceDetail> => {
    const { data } = await apiClient.post<OsintSourceDetail>(
      "/api/v1/admin/sources",
      payload,
    );
    return data;
  },

  update: async (
    id: number,
    payload: UpdateOsintSourceDto,
  ): Promise<OsintSourceDetail> => {
    const { data } = await apiClient.patch<OsintSourceDetail>(
      `/api/v1/admin/sources/${id}`,
      payload,
    );
    return data;
  },

  remove: async (id: number): Promise<DeleteOsintSourceResponse> => {
    const { data } = await apiClient.delete<DeleteOsintSourceResponse>(
      `/api/v1/admin/sources/${id}`,
    );
    return data;
  },

  testPull: async (id: number): Promise<TestPullResponse> => {
    const { data } = await apiClient.post<TestPullResponse>(
      `/api/v1/admin/sources/${id}/test-pull`,
    );
    return data;
  },

  /** On-demand fetch across all enabled sources (demo "Pull now"). */
  pullNow: async (): Promise<PullNowResult> => {
    const { data } = await apiClient.post<PullNowResult>(
      "/api/v1/admin/sources/pull-now",
    );
    return data;
  },

  /** On-demand fetch for a single source (real network fetch + persist). */
  pull: async (id: number): Promise<PullSourceResult> => {
    const { data } = await apiClient.post<PullSourceResult>(
      `/api/v1/admin/sources/${id}/pull`,
    );
    return data;
  },

  setCredential: async (
    id: number,
    payload: SetCredentialDto,
  ): Promise<SetCredentialResponse> => {
    const { data } = await apiClient.post<SetCredentialResponse>(
      `/api/v1/admin/sources/${id}/credential`,
      payload,
    );
    return data;
  },
};
