/**
 * Executive Critical Impact tile — service.
 *
 * Wraps GET /api/v1/dashboards/executive/critical-impacts which merges
 * critical osint_signal rows + open critical risk_case rows, each
 * pre-joined to affected contracts. Used by the inline drill-down frame
 * on the executive dashboard (replaces the old M5 regulatory-only popup).
 */
import { apiClient } from "@/lib/api-client";

export type CriticalImpactKind = "impact_signal" | "risk_case";

export interface CriticalImpactContract {
  id: string;
  contractNumber: string;
  titleEn: string | null;
  valueAed: number | string | null;
  currency: string | null;
  counterpartyName: string | null;
}

export interface CriticalImpactRow {
  kind: CriticalImpactKind;
  id: string;
  title: string;
  description: string | null;
  criticality: string;
  occurredAt: string;
  source: string;
  /**
   * Human-readable source label from osint_source.display_name when the
   * source resolves through the registry (e.g. "OFAC SDN List",
   * "Lloyd's List Maritime RSS"). NULL when the source slug doesn't have
   * a registry entry. FE renders this if present, falls back to `source`.
   */
  sourceDisplayName: string | null;
  sourceUrl: string | null;
  category: string;
  /**
   * Rule-based risk taxonomy slug (fn_classify_risk). See
   * components/risk/RiskTypePill for the canonical slug list. The FE
   * tolerates unknown values by falling back to "other" so additive DB
   * taxonomy expansion never breaks rendering.
   */
  riskType: string;
  contractsAffected: number;
  contracts: CriticalImpactContract[];
}

export interface CriticalImpactResponse {
  windowDays: number;
  asOf: string;
  rows: CriticalImpactRow[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
  requestId?: string;
}

export const criticalImpactService = {
  async list(params: { windowDays?: number } = {}): Promise<CriticalImpactResponse> {
    const windowDays = params.windowDays ?? 7;
    const res = await apiClient.get<Envelope<CriticalImpactResponse>>(
      `/api/v1/dashboards/executive/critical-impacts`,
      { params: { windowDays } },
    );
    return res.data.data;
  },
};
