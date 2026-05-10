/**
 * M10 / CR-C — Roles management types (FE adapter).
 * Source: .claude/workspace/current-module/types.ts § 5
 */

export type BuiltInRoleName =
  | 'Super Admin'
  | 'Admin'
  | 'User'
  | 'platform_admin'
  | 'executive'
  | 'legal_counsel'
  | 'contract_drafter'
  | 'contract_approver';

export const BUILT_IN_ROLE_NAMES: ReadonlyArray<BuiltInRoleName> = [
  'Super Admin',
  'Admin',
  'User',
  'platform_admin',
  'executive',
  'legal_counsel',
  'contract_drafter',
  'contract_approver',
] as const;

export interface CreateRoleDto {
  name: string;
  description?: string | null;
}

export interface RoleCreateResult {
  id: number;
  name: string;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string | null;
}

export interface RoleUpdateResult {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface RoleDeleteResult {
  success: true;
  id: number;
}

export interface RolePermissionGrantResult {
  granted: true;
  alreadyExists: boolean;
}

export interface RolePermissionRevokeResult {
  revoked: true;
  alreadyAbsent: boolean;
}
