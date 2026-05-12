/**
 * Shared Playwright helpers for Musanad E2E specs.
 *
 * `signInAs` drives the FE quick-sign-in panel at /auth/login (password
 * `ChangeMe@123` shared by all dev personas). The real auth flow is used so
 * the Zustand-persist store hydrates naturally — no addInitScript race
 * against the TanStack Router beforeLoad guard.
 *
 * Usage:
 *   import { test, expect } from '@playwright/test';
 *   import { signInAs } from './helpers';
 *
 *   test('AC-S1-01 [e2e] @persona-platform_admin', async ({ page }) => {
 *     await signInAs(page, 'platform_admin');
 *     await page.goto('/app/admin/sources');
 *     await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
 *   });
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type PersonaRole =
  | 'super_admin'
  | 'platform_admin'
  | 'legal_counsel'
  | 'contract_drafter'
  | 'contract_approver'
  | 'contract_recipient'
  | 'executive';

export const PERSONA_BUTTON_NAME: Record<PersonaRole, RegExp> = {
  super_admin: /Bootstrap Admin/i,
  platform_admin: /Omar Al Mansoori/i,
  legal_counsel: /Layla Counsel/i,
  contract_drafter: /Dana Drafter/i,
  contract_approver: /Aisha Approver/i,
  contract_recipient: /Rashid Recipient/i,
  executive: /Eman Executive/i,
};

export const signInAs = async (page: Page, role: PersonaRole): Promise<void> => {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: PERSONA_BUTTON_NAME[role] }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 15000 });
};

export const goAs = async (page: Page, role: PersonaRole, path: string): Promise<void> => {
  await signInAs(page, role);
  await page.goto(path);
};

export { expect };

/**
 * Truncate-and-reseed contract for E2E test isolation. Hits the BE's test
 * helper namespace (must run with NODE_ENV=test on the BE side). If the
 * endpoint is absent (404), this becomes a no-op so specs that don't need
 * isolation can run against dev data.
 */
export const resetTestState = async (page: Page): Promise<void> => {
  const beUrl = process.env['E2E_BE_BASE_URL'] ?? 'http://localhost:4000';
  try {
    const res = await page.request.post(`${beUrl}/api/v1/test/reset`);
    if (!res.ok() && res.status() !== 404) {
      throw new Error(`reset failed: HTTP ${res.status()}`);
    }
  } catch {
    // Endpoint not implemented yet — specs that need fresh state can skip.
  }
};
