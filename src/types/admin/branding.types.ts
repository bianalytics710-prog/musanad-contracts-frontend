/**
 * M10 / CR-C — Branding types (FE adapter).
 * Source: .claude/workspace/current-module/types.ts § 9
 */

export interface BrandingUploadResult {
  kind: 'logo' | 'favicon';
  /** supabase://branding/<tenant_id>/<filename> reference. */
  uri: string;
  /** Optional pre-signed URL for immediate FE preview. */
  signedUrl?: string;
}

export interface BrandingConfig {
  logoUri: string | null;
  faviconUri: string | null;
  colorPrimary: string | null;
  colorAccent: string | null;
  footerEn: string | null;
  footerAr: string | null;
}

export interface BrandingPatchDto {
  colorPrimary?: string;
  colorAccent?: string;
  footerEn?: string;
  footerAr?: string;
}
