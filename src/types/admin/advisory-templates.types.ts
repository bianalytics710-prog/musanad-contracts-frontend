/**
 * M16 / CR-H — Advisory Template types (FE adapter).
 * Source: api-contracts.json § advisory templates
 */
import type { PaginationMeta } from '@/types/api.types';

export type DraftType =
  | 'fm_invocation'
  | 'cure_notice'
  | 'sanctions_hold'
  | 'price_review'
  | 'icv_rectification'
  | 'insurance_renewal'
  | 'esg_concern'
  | 'custom';

export const DRAFT_TYPES: ReadonlyArray<DraftType> = [
  'fm_invocation',
  'cure_notice',
  'sanctions_hold',
  'price_review',
  'icv_rectification',
  'insurance_renewal',
  'esg_concern',
  'custom',
] as const;

export type DispatchChannel = 'email' | 'teams_capture' | 'slack_capture';

export const DISPATCH_CHANNELS: ReadonlyArray<DispatchChannel> = [
  'email',
  'teams_capture',
  'slack_capture',
] as const;

export interface AdvisoryTemplateListItem {
  id: number;
  templateId: string;
  displayNameEn: string;
  displayNameAr: string;
  draftType: DraftType;
  version: number;
  assignedApproverRole: string;
  dispatchChannels: DispatchChannel[];
  isActive: boolean;
  lastModifiedByName: string | null;
  updatedAt: string;
}

export interface AdvisoryTemplate {
  id: number;
  templateId: string;
  displayNameEn: string;
  displayNameAr: string;
  description: string | null;
  draftType: DraftType;
  bodyTemplateEn: string;
  bodyTemplateAr: string;
  parameterSchema: Record<string, unknown>;
  assignedApproverRole: string;
  dispatchChannels: DispatchChannel[];
  version: number;
  isActive: boolean;
  lastModifiedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListAdvisoryTemplatesResponse {
  data: AdvisoryTemplateListItem[];
  pagination: PaginationMeta;
}

export interface CreateAdvisoryTemplateDto {
  templateId: string;
  displayNameEn: string;
  displayNameAr: string;
  description?: string;
  draftType: DraftType;
  bodyTemplateEn: string;
  bodyTemplateAr: string;
  parameterSchema?: Record<string, unknown>;
  assignedApproverRole: string;
  dispatchChannels?: DispatchChannel[];
}

export interface UpdateAdvisoryTemplateDto {
  displayNameEn?: string;
  displayNameAr?: string;
  description?: string;
  bodyTemplateEn?: string;
  bodyTemplateAr?: string;
  parameterSchema?: Record<string, unknown>;
  assignedApproverRole?: string;
  dispatchChannels?: DispatchChannel[];
}
