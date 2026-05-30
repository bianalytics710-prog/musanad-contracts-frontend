/**
 * Admin / product-modules API service.
 * Wraps CR-V endpoints:
 *   GET  /api/v1/admin/modules
 *   PATCH /api/v1/admin/modules/:key
 *   PATCH /api/v1/admin/bundles/:code
 *   GET  /api/v1/admin/role-modules
 *   PATCH /api/v1/admin/role-modules/:roleId/:moduleKey
 */
import { apiClient } from "@/lib/api-client";

// ─── Catalog shapes ──────────────────────────────────────────────────────────

export interface ProductBundle {
  code: string;          // "clm" | "ecip" | "platform"
  labelKey: string;      // i18n key
  isCore: boolean;       // PLATFORM = true, cannot disable
  isEnabled: boolean;    // current enabled state
}

export interface ProductModule {
  key: string;           // e.g. "contracts.browse", "insights_hub"
  bundleCode: string;
  parentKey: string | null;
  labelKey: string;
  sidebarPath: string | null;
  defaultRoleCodes: string[];
  isEnabled: boolean;
  isCore: boolean;
  displayOrder: number;
}

export interface ProductModuleListResponse {
  bundles: ProductBundle[];
  modules: ProductModule[];
}

// ─── Role × Module matrix shapes ─────────────────────────────────────────────

export interface RoleRef {
  id: number;
  /** Stable identifier — matches role.name in the BE role table.
   *  Note: BE fn_role_module_matrix_get returns this as `code` for legacy
   *  reasons; the service unwrap below normalises `code` → `name`. */
  name: string;
  /** Legacy alias, present on the wire as `code`. Kept for read-back. */
  code?: string;
  label: string;
}

export interface MatrixModule {
  key: string;
  bundleCode: string;
  labelKey: string;
  isEnabledAtApp: boolean;
}

export type EffectiveState = "allow" | "deny";
export type AccessSource = "explicit" | "default";

export interface MatrixCell {
  roleId: number;
  moduleKey: string;
  effectiveState: EffectiveState;
  source: AccessSource;
}

export interface RoleModuleMatrix {
  roles: RoleRef[];
  modules: MatrixModule[];
  matrix: MatrixCell[];
}

// ─── Request payloads ────────────────────────────────────────────────────────

export interface PatchModulePayload {
  key: string;
  isEnabled: boolean;
  reason?: string;
}

export interface PatchBundlePayload {
  code: string;
  isEnabled: boolean;
  reason?: string;
}

export interface PatchRoleModulePayload {
  roleId: number;
  moduleKey: string;
  /** null = clear override (revert to default) */
  isAllowed: boolean | null;
  reason?: string;
}

// ─── Response shapes ─────────────────────────────────────────────────────────

export interface PatchModuleResponse {
  key: string;
  isEnabled: boolean;
}

export interface PatchBundleResponse {
  code: string;
  isEnabled: boolean;
}

export interface PatchRoleModuleResponse {
  roleId: number;
  moduleKey: string;
  isAllowed: boolean | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

// BE wraps every response in { success: true, data: <payload> }; this thin
// envelope is unwrapped at the service boundary so React components can use
// the typed payload directly without double `.data.data` access.
interface Envelope<T> { success: boolean; data: T; }

export const adminModulesService = {
  /**
   * Returns the full module catalog with current enabled state.
   * Maps to GET /api/v1/admin/modules → fn_product_module_list().
   */
  getProductModuleList: async (): Promise<ProductModuleListResponse> => {
    const { data } = await apiClient.get<Envelope<ProductModuleListResponse>>(
      "/api/v1/admin/modules",
    );
    return data.data;
  },

  /**
   * Toggle a single module on or off.
   * Cascade-disables child modules when parent is turned off.
   */
  patchModule: async (payload: PatchModulePayload): Promise<PatchModuleResponse> => {
    const { key, ...body } = payload;
    const { data } = await apiClient.patch<Envelope<PatchModuleResponse>>(
      `/api/v1/admin/modules/${encodeURIComponent(key)}`,
      body,
    );
    return data.data;
  },

  /**
   * Toggle an entire bundle on or off.
   * Platform bundle is rejected server-side (isCore=true guard).
   */
  patchBundle: async (payload: PatchBundlePayload): Promise<PatchBundleResponse> => {
    const { code, ...body } = payload;
    const { data } = await apiClient.patch<Envelope<PatchBundleResponse>>(
      `/api/v1/admin/bundles/${encodeURIComponent(code)}`,
      body,
    );
    return data.data;
  },

  /**
   * Returns the full role × module access matrix for the admin UI.
   * Maps to GET /api/v1/admin/role-modules → fn_role_module_matrix_get().
   *
   * BE returns each role as { id, code, label } (legacy naming from M6).
   * We normalise `code` → `name` here so the rest of the FE can rely on
   * RoleRef.name as the canonical role identifier (matches role.name in the
   * BE `role` table and the `default_role_codes` JSONB in `product_module`).
   */
  getRoleModuleMatrix: async (): Promise<RoleModuleMatrix> => {
    const { data } = await apiClient.get<Envelope<RoleModuleMatrix>>(
      "/api/v1/admin/role-modules",
    );
    const matrix = data.data;
    return {
      ...matrix,
      roles: (matrix.roles ?? []).map((r) => ({
        ...r,
        name: r.name ?? r.code ?? "",
      })),
    };
  },

  /**
   * Set (or clear) an explicit role × module access override.
   * null isAllowed = clear the override, reverting to default.
   */
  patchRoleModuleAccess: async (
    payload: PatchRoleModulePayload,
  ): Promise<PatchRoleModuleResponse> => {
    const { roleId, moduleKey, ...body } = payload;
    const { data } = await apiClient.patch<Envelope<PatchRoleModuleResponse>>(
      `/api/v1/admin/role-modules/${encodeURIComponent(String(roleId))}/${encodeURIComponent(moduleKey)}`,
      body,
    );
    return data.data;
  },
};
