/**
 * Admin / email server config service.
 * Wraps GET  /api/v1/admin/email-config
 *       PATCH /api/v1/admin/email-config
 *       POST  /api/v1/admin/email-config/test-send
 */
import { apiClient } from '@/lib/api-client';
import type {
  SmtpConfig,
  EmailConfigPatchDto,
  EmailTestSendRequest,
  EmailTestSendResult,
} from '@/types/admin/email-config.types';

export const adminEmailConfigService = {
  get: async (): Promise<SmtpConfig> => {
    const { data } = await apiClient.get<SmtpConfig>(
      '/api/v1/admin/email-config',
    );
    return data;
  },

  patch: async (payload: EmailConfigPatchDto): Promise<SmtpConfig> => {
    const { data } = await apiClient.patch<SmtpConfig>(
      '/api/v1/admin/email-config',
      payload,
    );
    return data;
  },

  testSend: async (payload?: EmailTestSendRequest): Promise<EmailTestSendResult> => {
    const { data } = await apiClient.post<EmailTestSendResult>(
      '/api/v1/admin/email-config/test-send',
      payload ?? {},
    );
    return data;
  },
};
