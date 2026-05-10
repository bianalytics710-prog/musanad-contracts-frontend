/**
 * M10 / CR-C — Audit chain types (FE adapter).
 * Source: .claude/workspace/current-module/types.ts § 2
 */

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export type AuditChainVerifyError =
  | 'hash_mismatch'
  | 'prev_hash_chain_break'
  | 'missing_row';

export interface AuditChainVerifyResult {
  verified: boolean;
  brokenAtSeq: number | null;
  error: AuditChainVerifyError | null;
  rowsWalked: number;
  elapsedMs: number;
}

export interface AuditChainVerifyRequest {
  startSeq?: number | null;
  endSeq?: number | null;
}
