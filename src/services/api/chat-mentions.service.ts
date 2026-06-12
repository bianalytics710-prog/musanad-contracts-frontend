/**
 * Chat mention typeahead service.
 *
 * Backs the @user / #contract / ~party dropdowns inside MentionableTextarea.
 * Each fetcher hits a permission-filtered BE endpoint, so the same fetcher
 * works for any role — drafters never see admins, etc.
 */
import { apiClient } from '@/lib/api-client';
import type { MentionKind, MentionTypeaheadResponse } from '@/types/entities/chat-orchestrator.types';

const BASE = '/api/v1/ai/chat/mentions';

export const chatMentionsService = {
  searchUsers: async (q: string, limit = 8): Promise<MentionTypeaheadResponse> => {
    const { data } = await apiClient.get<MentionTypeaheadResponse>(`${BASE}/users`, {
      params: { q, limit },
    });
    return data;
  },
  searchContracts: async (q: string, limit = 8): Promise<MentionTypeaheadResponse> => {
    const { data } = await apiClient.get<MentionTypeaheadResponse>(`${BASE}/contracts`, {
      params: { q, limit },
    });
    return data;
  },
  searchParties: async (q: string, limit = 8): Promise<MentionTypeaheadResponse> => {
    const { data } = await apiClient.get<MentionTypeaheadResponse>(`${BASE}/parties`, {
      params: { q, limit },
    });
    return data;
  },
};

export function triggerForKind(kind: MentionKind): string {
  if (kind === 'contract') return '#';
  if (kind === 'party') return '~';
  return '@';
}
