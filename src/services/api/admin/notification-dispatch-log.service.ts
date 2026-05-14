/**
 * Admin / Notification Dispatch Log service.
 * Wraps GET /api/v1/admin/notification-dispatch-log
 *       GET /api/v1/admin/notification-dispatch-log/:id
 *
 * A7 compliance: all HTTP calls go through apiClient here — never in pages/components.
 */
import { apiClient } from '@/lib/api-client';
import type {
  ListNotificationDispatchLogResponse,
  NotificationDispatchLog,
  ListNotificationDispatchLogParams,
} from '@/types/admin/notification-dispatch-log.types';

export const adminNotificationDispatchLogService = {
  list: async (
    params: ListNotificationDispatchLogParams = {},
  ): Promise<ListNotificationDispatchLogResponse> => {
    const { data } = await apiClient.get<ListNotificationDispatchLogResponse>(
      '/api/v1/admin/notification-dispatch-log',
      { params },
    );
    return data;
  },

  getById: async (id: number): Promise<NotificationDispatchLog> => {
    const { data } = await apiClient.get<NotificationDispatchLog>(
      `/api/v1/admin/notification-dispatch-log/${id}`,
    );
    return data;
  },
};
