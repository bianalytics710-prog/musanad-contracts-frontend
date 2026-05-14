/**
 * M17-M18 / CR-I+CR-J — Demo Harness API service.
 * T1: all apiClient calls here only.
 * A7: no apiClient imports outside service files.
 */
import { apiClient } from '@/lib/api-client';
import type {
  DemoScenarioListItem,
  DemoScenario,
  DemoTriggerResult,
  DemoResetResult,
  DemoTimeFreezeResult,
  DemoTimeUnfreezeResult,
  DemoTimeFreezeCurrentResult,
  DemoHealthCheckResult,
  DemoScenarioRunsResult,
  DemoScenarioRunsParams,
} from '@/types/admin/demo-harness.types';

interface ScenariosListResponse {
  data: DemoScenarioListItem[];
}

interface ScenarioDetailResponse {
  scenario: DemoScenario;
  recentRuns: import('@/types/admin/demo-harness.types').DemoScenarioRun[];
}

export const adminDemoHarnessService = {
  listScenarios: async (onlyActive = true): Promise<DemoScenarioListItem[]> => {
    const { data } = await apiClient.get<ScenariosListResponse>(
      '/api/v1/admin/demo/scenarios',
      { params: { onlyActive } },
    );
    return data.data;
  },

  getScenario: async (scenarioId: string): Promise<ScenarioDetailResponse> => {
    const { data } = await apiClient.get<ScenarioDetailResponse>(
      `/api/v1/admin/demo/scenarios/${encodeURIComponent(scenarioId)}`,
    );
    return data;
  },

  triggerScenario: async (scenarioId: string): Promise<DemoTriggerResult> => {
    const { data } = await apiClient.post<DemoTriggerResult>(
      `/api/v1/admin/demo/scenarios/${encodeURIComponent(scenarioId)}/trigger`,
    );
    return data;
  },

  resetDemo: async (confirmToken: string): Promise<DemoResetResult> => {
    const { data } = await apiClient.post<DemoResetResult>(
      '/api/v1/admin/demo/reset',
      { confirmToken },
    );
    return data;
  },

  setTimeFreeze: async (targetTimestamp: string): Promise<DemoTimeFreezeResult> => {
    const { data } = await apiClient.post<DemoTimeFreezeResult>(
      '/api/v1/admin/demo/time-freeze',
      { targetTimestamp },
    );
    return data;
  },

  unfreezeTime: async (): Promise<DemoTimeUnfreezeResult> => {
    const { data } = await apiClient.post<DemoTimeUnfreezeResult>(
      '/api/v1/admin/demo/time-unfreeze',
    );
    return data;
  },

  getCurrentFrozenTime: async (): Promise<DemoTimeFreezeCurrentResult> => {
    const { data } = await apiClient.get<DemoTimeFreezeCurrentResult>(
      '/api/v1/admin/demo/time-freeze/current',
    );
    return data;
  },

  healthCheck: async (): Promise<DemoHealthCheckResult> => {
    const { data } = await apiClient.get<DemoHealthCheckResult>(
      '/api/v1/admin/demo/health-check',
    );
    return data;
  },

  listRuns: async (params: DemoScenarioRunsParams = {}): Promise<DemoScenarioRunsResult> => {
    const { data } = await apiClient.get<DemoScenarioRunsResult>(
      '/api/v1/admin/demo/scenarios/runs',
      {
        params: {
          page: params.page ?? 1,
          limit: params.pageSize ?? 10,
          ...(params.scenarioId !== undefined && { scenarioId: params.scenarioId }),
          ...(params.success !== undefined && { success: params.success }),
        },
      },
    );
    return data;
  },
};
