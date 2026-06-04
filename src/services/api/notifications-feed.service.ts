/**
 * Thin axios wrapper for GET /api/v1/notifications/feed.
 *
 * The endpoint surfaces the current user's notification_dispatch_log rows
 * (in_app channel, sent + captured_only) newest-first. Used by
 * NotificationProvider to bring real BE notifications into the bell.
 */
import { apiClient } from "@/lib/api-client";

export interface NotificationFeedRow {
  id: number;
  notificationKind: string;
  priority: "low" | "medium" | "high" | "critical";
  subject: string | null;
  bodyRendered: string | null;
  contextPayload: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  deliveryCompletedAt: string | null;
}

export interface NotificationFeedResult {
  data: NotificationFeedRow[];
  pagination: { total: number; limit: number; offset: number };
}

export const notificationsFeedService = {
  list: async (
    params: { limit?: number; offset?: number } = {},
  ): Promise<NotificationFeedResult> => {
    const { data } = await apiClient.get<NotificationFeedResult>(
      "/api/v1/notifications/feed",
      { params },
    );
    return data;
  },
};
