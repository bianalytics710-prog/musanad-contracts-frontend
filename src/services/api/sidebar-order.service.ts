/**
 * Sidebar Role Order service — mig 539.
 *
 *  - getOrder()                       admin-only read
 *  - setOrder(map)                    admin-only write (replaces full map)
 *
 * The map is shaped { roleName: moduleKey[] }. An empty array (or missing
 * role entry) means "use built-in displayOrder for that role".
 */
import { apiClient, unwrap } from '@/lib/api-client';

export type SidebarOrderMap = Record<string, string[]>;

interface GetResponse {
  order: SidebarOrderMap;
}

interface SetResponse {
  order: SidebarOrderMap;
  updatedBy: number;
}

export const sidebarOrderService = {
  async getOrder(): Promise<SidebarOrderMap> {
    try {
      const { data } = await apiClient.get<{ success: boolean; data: GetResponse }>(
        '/api/v1/admin/sidebar-order',
      );
      const parsed = unwrap<GetResponse>(data);
      return parsed?.order ?? {};
    } catch {
      return {};
    }
  },

  async setOrder(order: SidebarOrderMap): Promise<SetResponse> {
    const { data } = await apiClient.put<{ success: boolean; data: SetResponse }>(
      '/api/v1/admin/sidebar-order',
      { order },
    );
    return unwrap<SetResponse>(data);
  },
};
