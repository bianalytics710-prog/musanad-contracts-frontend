/**
 * Notification Rules admin service — Platform Admin trigger-rule registry.
 *
 *   GET    /api/v1/admin/notification-rules
 *   POST   /api/v1/admin/notification-rules
 *   GET    /api/v1/admin/notification-rules/event-types
 *   PATCH  /api/v1/admin/notification-rules/:id/enabled
 *   PUT    /api/v1/admin/notification-rules/:id
 *   DELETE /api/v1/admin/notification-rules/:id
 */
import { apiClient } from "@/lib/api-client";

export type RuleChannel =
  | "email"
  | "in_app"
  | "teams_capture"
  | "slack_capture";

export type RulePriority = "low" | "medium" | "high" | "critical";

export interface NotificationRuleRow {
  id: number;
  tenantId: string | null;
  isSystemDefault: boolean;
  eventType: string;
  eventCategory: string;
  eventDisplayName: string;
  eventDescription: string | null;
  sortOrder: number;
  templateId: string;
  channel: RuleChannel;
  isEnabled: boolean;
  audience: Record<string, unknown>;
  condition: Record<string, unknown> | null;
  priority: RulePriority;
  cooldownMinutes: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationEventTypeRow {
  code: string;
  displayName: string;
  description: string | null;
  category: string;
  sortOrder: number;
}

export interface NotificationRuleInput {
  eventType: string;
  templateId: string;
  channel: RuleChannel;
  isEnabled: boolean;
  audience?: Record<string, unknown>;
  condition?: Record<string, unknown> | null;
  priority?: RulePriority;
  cooldownMinutes?: number;
  description?: string | null;
}

// ── v2 multi-channel multi-recipient model ─────────────────────────────

export type RecipientType = "role" | "user" | "context" | "email";

export interface RuleChannelRow {
  id?: number;
  channel: RuleChannel;
  templateSlug: string;
  subjectOverride?: string | null;
  bodyOverride?: string | null;
}

export interface RuleRecipientRow {
  id?: number;
  recipientType: RecipientType;
  recipientValue: string;
}

export interface NotificationRuleDetail {
  id: number;
  tenantId: string | null;
  isSystemDefault: boolean;
  module: string;
  name: string;
  description: string | null;
  eventType: string;
  eventCategory: string;
  eventDisplayName: string;
  isEnabled: boolean;
  priority: RulePriority;
  condition: Record<string, unknown> | null;
  cooldownMinutes: number;
  dedupeKey: string | null;
  ordering: number;
  channels: RuleChannelRow[];
  recipients: RuleRecipientRow[];
}

export interface NotificationRuleUpsertV2Input {
  module: string;
  name: string;
  description?: string | null;
  eventType: string;
  isEnabled: boolean;
  priority: RulePriority;
  condition?: Record<string, unknown> | null;
  cooldownMinutes: number;
  dedupeKey?: string | null;
  ordering: number;
  channels: RuleChannelRow[];
  recipients: RuleRecipientRow[];
}

export interface ModuleRow {
  module: string;
  ruleCount: number;
  eventCount: number;
}

export interface ContextResolverRow {
  code: string;
  label: string;
}

interface Envelope<T> {
  data: T;
}

export const adminNotificationRulesService = {
  list: async (params: {
    eventType?: string;
    channel?: RuleChannel;
    search?: string;
  } = {}): Promise<NotificationRuleRow[]> => {
    const r = await apiClient.get<Envelope<NotificationRuleRow[] | null>>(
      "/api/v1/admin/notification-rules",
      { params },
    );
    return r.data.data ?? [];
  },

  eventTypes: async (): Promise<NotificationEventTypeRow[]> => {
    const r = await apiClient.get<Envelope<NotificationEventTypeRow[] | null>>(
      "/api/v1/admin/notification-rules/event-types",
    );
    return r.data.data ?? [];
  },

  setEnabled: async (id: number, isEnabled: boolean): Promise<{ id: number; isEnabled: boolean }> => {
    const r = await apiClient.patch<{ id: number; isEnabled: boolean }>(
      `/api/v1/admin/notification-rules/${id}/enabled`,
      { isEnabled },
    );
    return r.data;
  },

  create: async (input: NotificationRuleInput): Promise<{ id: number }> => {
    const r = await apiClient.post<{ id: number }>(
      "/api/v1/admin/notification-rules",
      input,
    );
    return r.data;
  },

  update: async (
    id: number,
    input: NotificationRuleInput,
  ): Promise<{ id: number }> => {
    const r = await apiClient.put<{ id: number }>(
      `/api/v1/admin/notification-rules/${id}`,
      input,
    );
    return r.data;
  },

  deactivate: async (id: number): Promise<{ id: number; isActive: boolean }> => {
    const r = await apiClient.delete<{ id: number; isActive: boolean }>(
      `/api/v1/admin/notification-rules/${id}`,
    );
    return r.data;
  },

  // ── v2 endpoints ─────────────────────────────────────────────────────

  modules: async (): Promise<ModuleRow[]> => {
    const r = await apiClient.get<Envelope<ModuleRow[] | null>>(
      "/api/v1/admin/notification-rules/modules",
    );
    return r.data.data ?? [];
  },

  contextResolvers: async (): Promise<ContextResolverRow[]> => {
    const r = await apiClient.get<Envelope<ContextResolverRow[] | null>>(
      "/api/v1/admin/notification-rules/context-resolvers",
    );
    return r.data.data ?? [];
  },

  getDetail: async (id: number): Promise<NotificationRuleDetail> => {
    const r = await apiClient.get<NotificationRuleDetail>(
      `/api/v1/admin/notification-rules/${id}/detail`,
    );
    return r.data;
  },

  createV2: async (
    input: NotificationRuleUpsertV2Input,
  ): Promise<NotificationRuleDetail> => {
    const r = await apiClient.post<NotificationRuleDetail>(
      "/api/v1/admin/notification-rules",
      input,
    );
    return r.data;
  },

  updateV2: async (
    id: number,
    input: NotificationRuleUpsertV2Input,
  ): Promise<NotificationRuleDetail> => {
    const r = await apiClient.put<NotificationRuleDetail>(
      `/api/v1/admin/notification-rules/${id}`,
      input,
    );
    return r.data;
  },
};
