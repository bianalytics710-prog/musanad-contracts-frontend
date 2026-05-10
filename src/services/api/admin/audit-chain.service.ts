/**
 * Admin / audit chain verification service.
 * Wraps POST /api/v1/admin/audit/verify
 */
import { apiClient } from '@/lib/api-client';
import type { AuditChainVerifyRequest, AuditChainVerifyResult } from '@/types/admin/audit-chain.types';

export const adminAuditChainService = {
  verifyChain: async (
    params?: AuditChainVerifyRequest,
  ): Promise<AuditChainVerifyResult> => {
    const { data } = await apiClient.post<AuditChainVerifyResult>(
      '/api/v1/admin/audit/verify',
      params ?? {},
    );
    return data;
  },
};
