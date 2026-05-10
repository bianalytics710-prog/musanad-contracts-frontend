/**
 * M10 / CR-C — Notification template types (FE adapter).
 * Source: .claude/workspace/current-module/types.ts § 6
 */
import type { PaginationMeta } from '@/types/api.types';

export type NotificationTemplateChannel =
  | 'email'
  | 'in_app'
  | 'teams_capture'
  | 'slack_capture';

export const NOTIFICATION_TEMPLATE_CHANNELS: ReadonlyArray<NotificationTemplateChannel> =
  ['email', 'in_app', 'teams_capture', 'slack_capture'] as const;

export type RenderLocale = 'en' | 'ar';

export type DataClassification = 'demo' | 'pilot' | 'production';

export interface NotificationTemplate {
  id: number;
  tenantId: string;
  templateId: string;
  channel: NotificationTemplateChannel;
  subjectEn: string | null;
  subjectAr: string | null;
  bodyEn: string;
  bodyAr: string;
  parameterSchema: Record<string, string>;
  lastModifiedByName: string | null;
  dataClassification: DataClassification;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplateListItem {
  id: number;
  templateId: string;
  channel: NotificationTemplateChannel;
  subjectEn: string | null;
  subjectAr: string | null;
  lastModifiedByName: string | null;
  dataClassification: DataClassification;
  isActive: boolean;
  updatedAt: string;
}

export interface ListNotificationTemplatesResponse {
  data: NotificationTemplateListItem[];
  pagination: PaginationMeta;
}

export interface NotificationTemplateUpdateDto {
  subjectEn?: string | null;
  subjectAr?: string | null;
  bodyEn?: string;
  bodyAr?: string;
  parameterSchema?: Record<string, string>;
}

export interface NotificationTemplateRenderRequest {
  templateId: string;
  channel: NotificationTemplateChannel;
  locale: RenderLocale;
  parameters: Record<string, string | number | boolean>;
}

export interface NotificationTemplateRenderResult {
  subject: string | null;
  body: string;
  missingParameters: string[];
  extraParameters: string[];
}
