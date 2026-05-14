/**
 * Notification Preferences service.
 * Wraps GET   /api/v1/users/me/notification-preferences
 *       PATCH /api/v1/users/me/notification-preferences
 *
 * A7 compliance: all HTTP calls go through apiClient here — never in pages/components.
 */
import { apiClient } from '@/lib/api-client';
import type {
  ListNotificationPreferencesResponse,
  NotificationSubscription,
  SetNotificationPreferenceDto,
} from '@/types/notification-preferences.types';

export const notificationPreferencesService = {
  list: async (): Promise<ListNotificationPreferencesResponse> => {
    const { data } = await apiClient.get<ListNotificationPreferencesResponse>(
      '/api/v1/users/me/notification-preferences',
    );
    return data;
  },

  set: async (
    payload: SetNotificationPreferenceDto,
  ): Promise<NotificationSubscription> => {
    const { data } = await apiClient.patch<NotificationSubscription>(
      '/api/v1/users/me/notification-preferences',
      payload,
    );
    return data;
  },
};
