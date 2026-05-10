/**
 * M10 / CR-C — Tenant types (FE adapter).
 * Source: .claude/workspace/current-module/types.ts § 4
 */
import type { PaginationMeta } from '@/types/api.types';

export type TenantRiskAppetite = 'low' | 'standard' | 'high';

export const TENANT_RISK_APPETITES: ReadonlyArray<TenantRiskAppetite> = [
  'low',
  'standard',
  'high',
] as const;

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  industry: string | null;
  riskAppetite: TenantRiskAppetite;
  dataRegion: string | null;
  configPack: string;
  isActive: boolean;
  createdAt: string;
}

export interface TenantDetail extends TenantListItem {
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
}

export interface ListTenantsResponse {
  data: TenantListItem[];
  pagination: PaginationMeta;
}
