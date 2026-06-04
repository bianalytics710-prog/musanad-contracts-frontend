/**
 * Admin Risk Scoring Config service — mig 529.
 *
 * Endpoints:
 *   GET /api/v1/admin/risk-scoring-config   — fn_risk_scoring_config_get
 *   PUT /api/v1/admin/risk-scoring-config   — fn_risk_scoring_config_set
 *
 * The PUT supports partial updates — any top-level key omitted from the
 * body is left unchanged. After a successful PUT the BE asynchronously
 * recomputes every snapshot.
 */
import { apiClient, unwrap } from '@/lib/api-client';

export interface SignalSeverityWeights {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
}

export interface ValueTier {
  minAed: number;
  points: number;
  label: string;
}

export interface DurationTier {
  minMonths: number;
  points: number;
  label: string;
}

export interface SectorComplexity {
  byType: Record<string, number>;
  default: number;
}

export interface ClauseSignals {
  broadIndemnity: number;
  liabilityCapHigh: number;
  singleSource: number;
  regulatorsThreePlus: number;
  cap: number;
}

export interface RiskScoringBands {
  lowMax: number;
  mediumMax: number;
}

export interface RiskScoringConfig {
  signalSeverityWeights: SignalSeverityWeights;
  signalBucketCap: { cap: number };
  valueTiers: { tiers: ValueTier[] };
  durationTiers: { tiers: DurationTier[] };
  sectorComplexity: SectorComplexity;
  clauseSignals: ClauseSignals;
  bands: RiskScoringBands;
}

export interface RiskScoringConfigSetResponse {
  updatedKeys: string[];
  config: RiskScoringConfig;
}

export const adminRiskScoringConfigService = {
  async get(): Promise<RiskScoringConfig> {
    const { data } = await apiClient.get<{ success: boolean; data: RiskScoringConfig }>(
      '/api/v1/admin/risk-scoring-config',
    );
    return unwrap<RiskScoringConfig>(data);
  },

  async set(input: Partial<RiskScoringConfig>): Promise<RiskScoringConfigSetResponse> {
    const { data } = await apiClient.put<{ success: boolean; data: RiskScoringConfigSetResponse }>(
      '/api/v1/admin/risk-scoring-config',
      input,
    );
    return unwrap<RiskScoringConfigSetResponse>(data);
  },
};
