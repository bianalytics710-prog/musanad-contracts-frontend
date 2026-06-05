/**
 * Industry Catalog admin service — R-IL Platform Admin endpoints.
 *
 * Backs the /app/admin/industry-catalogs pages. All endpoints require the
 * platform.catalog.manage permission (granted to Super Admin and
 * platform_admin).
 *
 *   GET    /api/v1/admin/industry-catalogs
 *   GET    /api/v1/admin/industry-catalogs/:industryId/benchmarks
 *   POST   /api/v1/admin/industry-catalogs/:industryId/benchmarks
 *   PUT    /api/v1/admin/industry-catalogs/benchmarks/:id
 *   DELETE /api/v1/admin/industry-catalogs/benchmarks/:id
 *   (analogous for cost-components)
 */
import { apiClient } from '@/lib/api-client';

export interface IndustryRow {
  id: number;
  code: string;
  displayLabelEn: string;
  displayLabelAr: string | null;
  description: string | null;
  isActive: boolean;
  tenantCount: number;
  benchmarkCount: number;
  costComponentCount: number;
}

export interface BenchmarkCatalogRow {
  id: number;
  industryId: number | null;
  tenantId: string | null;
  code: string;
  displayLabelEn: string;
  displayLabelAr: string | null;
  unitLabel: string;
  volumeUnitLabel: string;
  typicalLow: string | null;
  typicalHigh: string | null;
  kickerText: string | null;
  isFx: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface CostComponentCatalogRow {
  id: number;
  industryId: number | null;
  tenantId: string | null;
  code: string;
  displayLabelEn: string;
  displayLabelAr: string | null;
  sign: '+' | '-';
  isRevenue: boolean;
  sortOrder: number;
  description: string | null;
  isActive: boolean;
}

export interface BenchmarkInput {
  industryId?: number | null;
  tenantId?: string | null;
  code: string;
  displayLabelEn: string;
  displayLabelAr?: string | null;
  unitLabel: string;
  volumeUnitLabel: string;
  typicalLow?: number | null;
  typicalHigh?: number | null;
  kickerText?: string | null;
  isFx?: boolean;
  sortOrder?: number;
}

export interface CostComponentInput {
  industryId?: number | null;
  tenantId?: string | null;
  code: string;
  displayLabelEn: string;
  displayLabelAr?: string | null;
  sign: '+' | '-';
  isRevenue?: boolean;
  sortOrder?: number;
  description?: string | null;
}

interface Envelope<T> { data: T }

export interface IndustryInput {
  code: string;
  displayLabelEn: string;
  displayLabelAr?: string | null;
  description?: string | null;
}

export const industryCatalogService = {
  listIndustries: async (): Promise<IndustryRow[]> => {
    const r = await apiClient.get<Envelope<IndustryRow[] | null>>(
      `/api/v1/admin/industry-catalogs`,
    );
    return r.data.data ?? [];
  },

  createIndustry: async (input: IndustryInput): Promise<{ id: number }> => {
    const r = await apiClient.post<{ id: number }>(
      `/api/v1/admin/industry-catalogs`,
      input,
    );
    return r.data;
  },

  updateIndustry: async (id: number, input: IndustryInput): Promise<{ id: number }> => {
    const r = await apiClient.put<{ id: number }>(
      `/api/v1/admin/industry-catalogs/${id}`,
      input,
    );
    return r.data;
  },

  deactivateIndustry: async (id: number): Promise<{ id: number; isActive: boolean }> => {
    const r = await apiClient.delete<{ id: number; isActive: boolean }>(
      `/api/v1/admin/industry-catalogs/${id}`,
    );
    return r.data;
  },

  listBenchmarks: async (industryId: number, tenantId?: string): Promise<BenchmarkCatalogRow[]> => {
    const r = await apiClient.get<Envelope<BenchmarkCatalogRow[] | null>>(
      `/api/v1/admin/industry-catalogs/${industryId}/benchmarks`,
      { params: tenantId ? { tenantId } : undefined },
    );
    return r.data.data ?? [];
  },

  createBenchmark: async (industryId: number, input: BenchmarkInput): Promise<{ id: number }> => {
    const r = await apiClient.post<{ id: number }>(
      `/api/v1/admin/industry-catalogs/${industryId}/benchmarks`,
      input,
    );
    return r.data;
  },

  updateBenchmark: async (id: number, input: BenchmarkInput): Promise<{ id: number }> => {
    const r = await apiClient.put<{ id: number }>(
      `/api/v1/admin/industry-catalogs/benchmarks/${id}`,
      input,
    );
    return r.data;
  },

  deactivateBenchmark: async (id: number): Promise<{ id: number; isActive: boolean }> => {
    const r = await apiClient.delete<{ id: number; isActive: boolean }>(
      `/api/v1/admin/industry-catalogs/benchmarks/${id}`,
    );
    return r.data;
  },

  listCostComponents: async (industryId: number, tenantId?: string): Promise<CostComponentCatalogRow[]> => {
    const r = await apiClient.get<Envelope<CostComponentCatalogRow[] | null>>(
      `/api/v1/admin/industry-catalogs/${industryId}/cost-components`,
      { params: tenantId ? { tenantId } : undefined },
    );
    return r.data.data ?? [];
  },

  createCostComponent: async (industryId: number, input: CostComponentInput): Promise<{ id: number }> => {
    const r = await apiClient.post<{ id: number }>(
      `/api/v1/admin/industry-catalogs/${industryId}/cost-components`,
      input,
    );
    return r.data;
  },

  updateCostComponent: async (id: number, input: CostComponentInput): Promise<{ id: number }> => {
    const r = await apiClient.put<{ id: number }>(
      `/api/v1/admin/industry-catalogs/cost-components/${id}`,
      input,
    );
    return r.data;
  },

  deactivateCostComponent: async (id: number): Promise<{ id: number; isActive: boolean }> => {
    const r = await apiClient.delete<{ id: number; isActive: boolean }>(
      `/api/v1/admin/industry-catalogs/cost-components/${id}`,
    );
    return r.data;
  },
};
