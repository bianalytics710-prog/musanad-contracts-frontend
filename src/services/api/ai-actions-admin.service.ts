/**
 * Platform Admin — AI Chat Action catalog service.
 *
 * Wraps GET /api/v1/admin/ai-actions + PATCH /:code.
 */
import { apiClient } from '@/lib/api-client';
import type { ChatActionCatalogRow } from '@/types/entities/chat-orchestrator.types';

const BASE = '/api/v1/admin/ai-actions';

export const aiActionsAdminService = {
  list: async (): Promise<ChatActionCatalogRow[]> => {
    const { data } = await apiClient.get<{ data?: ChatActionCatalogRow[] }>(BASE);
    return data?.data ?? [];
  },
  toggle: async (code: string, isEnabled: boolean): Promise<void> => {
    await apiClient.patch(`${BASE}/${code}`, { isEnabled });
  },
};
