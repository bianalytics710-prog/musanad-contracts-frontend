/**
 * Shared Playwright helpers for Musanad E2E specs.
 *
 * All personas use the FE quick-sign-in panel at /auth/login (password
 * `ChangeMe@123`). Helper signs in as the requested role and returns a
 * page already on /app/admin (or wherever the FE redirects to post-login).
 *
 * Usage:
 *   import { test, expect } from '@playwright/test';
 *   import { signInAs } from './helpers';
 *
 *   test('AC-S1-01 [e2e] @persona-platform_admin — list view loads', async ({ page }) => {
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

const PERSONA_BUTTON_NAME: Record<PersonaRole, RegExp> = {
  super_admin: /Bootstrap Admin/i,
  platform_admin: /Omar Al Mansoori/i,
  legal_counsel: /Layla Counsel/i,
  contract_drafter: /Dana Drafter/i,
  contract_approver: /Aisha Approver/i,
  contract_recipient: /Rashid Recipient/i,
  executive: /Eman Executive/i,
};

/**
 * Click the dev quick-sign-in button for the named persona. Waits for the
 * post-login navigation to settle.
 */
export const signInAs = async (page: Page, role: PersonaRole): Promise<void> => {
  await page.goto('/auth/login');
  const btn = page.getByRole('button', { name: PERSONA_BUTTON_NAME[role] });
  await expect(btn).toBeVisible();
  await btn.click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 10_000 });
};

/**
 * Visit a route as a specific persona. Combines signInAs() + page.goto for
 * tests that don't care about the post-login landing page.
 */
export const goAs = async (page: Page, role: PersonaRole, path: string): Promise<void> => {
  await signInAs(page, role);
  await page.goto(path);
};

/**
 * Truncate-and-reseed contract for E2E test isolation. Hits the BE's test
 * helper namespace (must run with NODE_ENV=test on the BE side). Each E2E
 * spec calls this in beforeEach to keep state predictable.
 *
 * NOTE: requires the BE to expose a /api/v1/test/reset endpoint when
 * NODE_ENV=test. If absent, this becomes a no-op so specs that don't need
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
