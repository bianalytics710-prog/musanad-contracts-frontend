/**
 * AI Chat Orchestrator — FE types.
 *
 * Wire-compatible with src/types/chat-orchestrator.types.ts on the BE.
 */

export type MentionKind = 'user' | 'contract' | 'party' | 'prospect';

export interface ChatMention {
  /** Stable id used by React lists (e.g. "user:5"). */
  id: string;
  kind: MentionKind;
  /** Display label shown in the chip. */
  label: string;
  /** Internal master id; null for kind='prospect'. */
  refId: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  /** Plain text + @[Label](kind:id) / #[Label](contract:id) / ~[Label](party:id) / ~[Label](prospect:_) markup. */
  content: string;
}

export interface ProposalPreviewParam {
  key: string;
  label: string;
  text?: string;
  mention?: ChatMention;
}

export interface ProposalReceipt {
  message: string;
  link?: string;
  params?: Record<string, unknown>;
}

export interface MentionTypeaheadRow {
  id: number | null;
  label: string;
  subLabel?: string;
  meta?: Record<string, unknown>;
  /** When kind=party, marks the synthetic "+ Create new prospect" row. */
  isProspect?: boolean;
  prospectName?: string;
}

export interface MentionTypeaheadResponse {
  kind: MentionKind;
  results: MentionTypeaheadRow[];
}

export interface ChatAskBody {
  messages: ChatMessage[];
  mentions: ChatMention[];
}

export interface ChatActionCatalogRow {
  code: string;
  kind: 'resolver' | 'write_action';
  label: string;
  descriptionForLlm: string;
  requiredPermission: string;
  handlerId: string;
  isDestructive: boolean;
  sortOrder: number;
  enabledByDefault: boolean;
  tenantOverride: boolean | null;
  effectiveEnabled: boolean;
}
