/**
 * M16 / CR-H — Notification Dispatch Log types (FE adapter).
 * Source: api-contracts.json § notification-dispatch-log
 */
import type { PaginationMeta } from '@/types/api.types';

export type DispatchLogChannel =
  | 'email'
  | 'in_app'
  | 'teams_capture'
  | 'slack_capture';

export type DispatchLogStatus =
  | 'sent'
  | 'failed'
  | 'captured_only'
  | 'pending_retry'
  | 'final_failed'
  | 'suppressed_by_preference';

export type NotificationKind =
  | 'alert'
  | 'advisory'
  | 'approval_request'
  | 'signature_request'
  | 'system'
  | 'risk_case'
  | 'report';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export const DISPATCH_LOG_CHANNELS: ReadonlyArray<DispatchLogChannel> = [
  'email',
  'in_app',
  'teams_capture',
  'slack_capture',
] as const;

export const DISPATCH_LOG_STATUSES: ReadonlyArray<DispatchLogStatus> = [
  'sent',
  'failed',
  'captured_only',
  'pending_retry',
  'final_failed',
  'suppressed_by_preference',
] as const;

export const NOTIFICATION_KINDS: ReadonlyArray<NotificationKind> = [
  'alert',
  'advisory',
  'approval_request',
  'signature_request',
  'system',
  'risk_case',
  'report',
] as const;

export interface NotificationDispatchLogListItem {
  id: number;
  channel: DispatchLogChannel;
  notificationKind: NotificationKind;
  priority: NotificationPriority;
  status: DispatchLogStatus;
  recipientUserId: number | null;
  recipientAddress: string | null;
  bodyRendered: string | null; // truncated to 500 chars in list
  deliveryAttemptedAt: string | null;
  retryCount: number;
  errorMessage: string | null;
  advisoryDraftId: number | null;
}

export interface NotificationDispatchLog {
  id: number;
  channel: DispatchLogChannel;
  notificationKind: NotificationKind;
  priority: NotificationPriority;
  status: DispatchLogStatus;
  recipientUserId: number | null;
  recipientAddress: string | null;
  bodyRendered: string | null;
  subject: string | null;
  contextPayload: Record<string, unknown> | null;
  channelPayload: Record<string, unknown> | null; // teams/slack capture payload
  deliveryAttemptedAt: string | null;
  retryCount: number;
  errorMessage: string | null;
  advisoryDraftId: number | null;
  contractId: number | null;
  correlationId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListNotificationDispatchLogResponse {
  data: NotificationDispatchLogListItem[];
  pagination: PaginationMeta;
}

export interface ListNotificationDispatchLogParams {
  page?: number;
  limit?: number;
  channel?: DispatchLogChannel;
  status?: DispatchLogStatus;
  notificationKind?: NotificationKind;
  priority?: NotificationPriority;
  recipientUserId?: number;
  from?: string;
  to?: string;
}
