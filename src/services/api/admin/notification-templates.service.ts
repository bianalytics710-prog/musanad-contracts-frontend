/**
 * Admin / notification templates service.
 * Wraps GET   /api/v1/admin/notification-templates
 *       GET   /api/v1/admin/notification-templates/:id
 *       PATCH /api/v1/admin/notification-templates/:id
 *       POST  /api/v1/admin/notification-templates/render
 */
import { apiClient } from '@/lib/api-client';
import type {
  ListNotificationTemplatesResponse,
  NotificationTemplate,
  NotificationTemplateUpdateDto,
  NotificationTemplateRenderRequest,
  NotificationTemplateRenderResult,
  NotificationTemplateChannel,
} from '@/types/admin/notification-templates.types';

export interface ListNotificationTemplatesParams {
  page?: number;
  limit?: number;
  channel?: NotificationTemplateChannel;
  search?: string;
}

export const adminNotificationTemplatesService = {
  list: async (
    params: ListNotificationTemplatesParams = {},
  ): Promise<ListNotificationTemplatesResponse> => {
    const { data } = await apiClient.get<ListNotificationTemplatesResponse>(
      '/api/v1/admin/notification-templates',
      { params },
    );
    return data;
  },

  getById: async (id: number): Promise<NotificationTemplate> => {
    const { data } = await apiClient.get<NotificationTemplate>(
      `/api/v1/admin/notification-templates/${id}`,
    );
    return data;
  },

  update: async (
    id: number,
    payload: NotificationTemplateUpdateDto,
  ): Promise<NotificationTemplate> => {
    const { data } = await apiClient.patch<NotificationTemplate>(
      `/api/v1/admin/notification-templates/${id}`,
      payload,
    );
    return data;
  },

  render: async (
    payload: NotificationTemplateRenderRequest,
  ): Promise<NotificationTemplateRenderResult> => {
    const { data } = await apiClient.post<NotificationTemplateRenderResult>(
      '/api/v1/admin/notification-templates/render',
      payload,
    );
    return data;
  },
};
