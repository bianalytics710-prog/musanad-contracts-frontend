/**
 * M10 / CR-C — Email config types (FE adapter).
 * Source: .claude/workspace/current-module/types.ts § 8
 */

export type SmtpEncryption = 'none' | 'tls' | 'ssl' | 'starttls';

export const SMTP_ENCRYPTIONS: ReadonlyArray<SmtpEncryption> = [
  'none',
  'tls',
  'ssl',
  'starttls',
] as const;

export interface SmtpConfig {
  smtpHost: string;
  smtpPort: number;
  smtpEncryption: SmtpEncryption;
  authUser: string;
  authPassRefSet: boolean;
  fromAddress: string;
  fromNameEn: string;
  fromNameAr: string;
  replyTo: string;
  dailySendLimit: number;
  enabled: boolean;
}

export interface EmailConfigPatchDto {
  smtpHost?: string;
  smtpPort?: number;
  smtpEncryption?: SmtpEncryption;
  authUser?: string;
  /** Write-only. Not returned. Empty string clears the stored value. */
  authPassRef?: string;
  fromAddress?: string;
  fromNameEn?: string;
  fromNameAr?: string;
  replyTo?: string;
  dailySendLimit?: number;
  enabled?: boolean;
}

export interface EmailTestSendRequest {
  recipient?: string;
}

export interface EmailTestSendResult {
  sent: true;
  deliveryMs: number;
  recipient: string;
}
