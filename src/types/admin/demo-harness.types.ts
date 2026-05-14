/**
 * M17-M18 / CR-I+CR-J — Demo Harness types.
 * Derived from api-contracts.json typeDefinitions.
 * T7: no `any` types.
 */

export interface DemoOutcomeBaseline {
  correlationCount: number;
  alertCount: number;
  advisoryDraftCount: number;
  signalCount: number;
}

export interface DemoLastRunSummary {
  triggeredAt: string;
  success: boolean;
  elapsedMs: number | null;
  outcome: DemoOutcomeBaseline | null;
}

export interface DemoScenarioListItem {
  id: number;
  scenarioId: string;
  displayNameEn: string;
  displayNameAr: string;
  description: string | null;
  tier: 1 | 2;
  seedPackRef: string;
  expectedOutcomes: DemoOutcomeBaseline;
  isActive: boolean;
  lastRun: DemoLastRunSummary | null;
}

export interface DemoScenario {
  id: number;
  scenarioId: string;
  displayNameEn: string;
  displayNameAr: string;
  description: string | null;
  tier: number;
  seedPackRef: string;
  eventInjectionPayload: Record<string, unknown>;
  expectedOutcomes: DemoOutcomeBaseline;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
}

export interface DemoScenarioRun {
  id: number;
  tenantId: string;
  demoScenarioId: number;
  scenarioId: string;
  triggeredBy: number;
  triggeredByName: string | null;
  triggeredAt: string;
  outcome: DemoOutcomeBaseline | null;
  success: boolean;
  elapsedMs: number | null;
  errorMessage: string | null;
}

export interface DemoSubsystemHealth {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  lastChecked: string | null;
  remediation: string | null;
}

export interface DemoHealthCheckResult {
  subsystems: DemoSubsystemHealth[];
  overallStatus: 'ok' | 'degraded' | 'down';
}

export interface DemoTriggerResult {
  runId: number;
  elapsedMs: number;
  success: boolean;
  outcome: DemoOutcomeBaseline;
}

export interface DemoResetResult {
  elapsedMs: number;
  purgeStats: Record<string, unknown>;
  reloadStats: Record<string, unknown>;
  slaWarn: boolean;
}

export interface DemoTimeFreezeResult {
  frozenAt: string;
  actualNow: string;
}

export interface DemoTimeUnfreezeResult {
  unfrozenAt: string;
}

export interface DemoTimeFreezeCurrentResult {
  frozenAt: string | null;
  actualNow: string;
}

export interface DemoScenarioRunsParams {
  page?: number;
  pageSize?: number;
  scenarioId?: string;
  success?: boolean;
}

export interface DemoScenarioRunsResult {
  data: DemoScenarioRun[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Zod-validated reset DTO shape (frontend side). */
export interface ResetDemoDto {
  confirmToken: string;
}

/** Zod-validated time-freeze DTO shape (frontend side). */
export interface TimeFreezeSetDto {
  targetTimestamp: string;
}
