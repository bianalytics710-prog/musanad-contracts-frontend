/**
 * Index-Linked Contracts tenant-side catalog service — R-IL Phase B.
 *
 * Reads the resolved per-tenant catalog (industry rows ∪ tenant overrides)
 * for the current tenant. Drives FE labels for the Index-Linked Contracts
 * module (display strings, units, slider bounds, waterfall sort, kicker).
 *
 *   GET /api/v1/index-linked/catalog/benchmarks       (finance.margin.read)
 *   GET /api/v1/index-linked/catalog/cost-components  (finance.margin.read)
 */
import { apiClient } from '@/lib/api-client';

export type CatalogScope = 'industry' | 'tenant';

export interface CatalogBenchmark {
  id: number;
  code: string;
  displayLabelEn: string;
  displayLabelAr: string | null;
  unitLabel: string;            // e.g. "USD/bbl", "AED/MT"
  volumeUnitLabel: string;      // e.g. "bbl", "MT"
  typicalLow: string | null;    // NUMERIC::text — parseFloat before math
  typicalHigh: string | null;
  kickerText: string | null;    // page kicker (e.g. "Sell-side oil-trade desk")
  isFx: boolean;
  sortOrder: number;
  scope: CatalogScope;
}

export interface CatalogCostComponent {
  id: number;
  code: string;
  displayLabelEn: string;
  displayLabelAr: string | null;
  sign: '+' | '-';
  isRevenue: boolean;
  sortOrder: number;
  description: string | null;
  scope: CatalogScope;
}

interface Envelope<T> {
  data: T;
}

export const indexLinkedCatalogService = {
  benchmarks: async (): Promise<CatalogBenchmark[]> => {
    const res = await apiClient.get<Envelope<CatalogBenchmark[] | null>>(
      `/api/v1/index-linked/catalog/benchmarks`,
    );
    return res.data.data ?? [];
  },

  costComponents: async (): Promise<CatalogCostComponent[]> => {
    const res = await apiClient.get<Envelope<CatalogCostComponent[] | null>>(
      `/api/v1/index-linked/catalog/cost-components`,
    );
    return res.data.data ?? [];
  },
};
