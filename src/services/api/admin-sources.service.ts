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
