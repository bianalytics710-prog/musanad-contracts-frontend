/**
 * M16 / CR-H — Notification Preferences types (FE adapter).
 * Source: api-contracts.json § notification-preferences
 */

export type NotificationKindPref =
  | 'alert'
  | 'advisory'
  | 'approval_request'
  | 'signature_request'
  | 'system'
  | 'risk_case'
  | 'report';

export type NotificationChannelPref =
  | 'email'
  | 'in_app'
  | 'teams_capture'
  | 'slack_capture';

export type PriorityMin = 'low' | 'medium' | 'high' | 'critical';

export const NOTIFICATION_KINDS_PREF: ReadonlyArray<NotificationKindPref> = [
  'alert',
  'advisory',
  'approval_request',
  'signature_request',
  'system',
  'risk_case',
  'report',
] as const;

export const NOTIFICATION_CHANNELS_PREF: ReadonlyArray<NotificationChannelPref> = [
  'email',
  'in_app',
  'teams_capture',
  'slack_capture',
] as const;

export const PRIORITY_MIN_OPTIONS: ReadonlyArray<PriorityMin> = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export interface NotificationSubscriptionCell {
  notificationKind: NotificationKindPref;
  channel: NotificationChannelPref;
  enabled: boolean;
  priorityMin: PriorityMin;
  isExplicit: boolean; // false = synthesised default
  id: number | null;
}

export interface NotificationSubscription {
  id: number;
  userId: number;
  notificationKind: NotificationKindPref;
  channel: NotificationChannelPref;
  enabled: boolean;
  priorityMin: PriorityMin;
  createdAt: string;
  updatedAt: string;
}

export interface ListNotificationPreferencesResponse {
  data: NotificationSubscriptionCell[];
}

export interface SetNotificationPreferenceDto {
  notificationKind: NotificationKindPref;
  channel: NotificationChannelPref;
  priorityMin?: PriorityMin;
  enabled?: boolean;
}
