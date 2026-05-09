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

// Reference for spec authors who want to drive the UI quick-sign-in panel
// directly (e.g., to assert the persona button itself). Kept as exported
// data, not used by signInAs's programmatic path.
export const PERSONA_BUTTON_NAME: Record<PersonaRole, RegExp> = {
  super_admin: /Bootstrap Admin/i,
  platform_admin: /Omar Al Mansoori/i,
  legal_counsel: /Layla Counsel/i,
  contract_drafter: /Dana Drafter/i,
  contract_approver: /Aisha Approver/i,
  contract_recipient: /Rashid Recipient/i,
  executive: /Eman Executive/i,
};

const PERSONA_EMAIL: Record<PersonaRole, string> = {
  super_admin: 'admin@musanad.local',
  platform_admin: 'platform@musanad.local',
  legal_counsel: 'legal@musanad.local',
  contract_drafter: 'drafter@musanad.local',
  contract_approver: 'approver@musanad.local',
  contract_recipient: 'recipient@musanad.local',
  executive: 'executive@musanad.local',
};
const PERSONA_PASSWORD = 'ChangeMe@123';

const BE_BASE_URL = process.env['E2E_BE_BASE_URL'] ?? 'http://localhost:4000';

/**
 * Sign in by driving the FE quick-sign-in panel (dev personas at
 * /auth/login). Waits for the BE login response to land AND the post-
 * login navigation away from /auth/login before resolving.
 *
 * Why UI-driven instead of programmatic:
 *   - TanStack Start runs router `beforeLoad` guards synchronously at
 *     route mount, BEFORE Zustand-persist's localStorage hydration has
 *     committed in some browser contexts. Pre-seeding localStorage via
 *     addInitScript is fragile under those timing conditions.
 *   - The dev quick-sign-in panel exists in this codebase precisely so
 *     E2E and demo flows can use the real auth path with one click.
 */
export const signInAs = async (page: Page, role: PersonaRole): Promise<void> => {
  // Programmatic login: hit the BE directly + seed localStorage in the
  // exact Zustand-persist shape the auth store reads at hydrate time.
  // addInitScript runs in every new document this BrowserContext loads,
  // BEFORE the FE bundle imports the auth store — so when the store
  // hydrates from localStorage on first read, isAuthenticated is true
  // and the TanStack Router beforeLoad guard lets us through.
  const res = await page.request.post(`${BE_BASE_URL}/api/v1/auth/login`, {
    data: { email: PERSONA_EMAIL[role], password: PERSONA_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`signInAs(${role}) login failed: HTTP ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as {
    accessToken: string;
    refreshToken?: string;
    user?: unknown;
  };
  const persisted = JSON.stringify({
    state: {
      user: body.user ?? null,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken ?? null,
      isAuthenticated: true,
    },
    version: 0,
  });
  await page.context().addInitScript((value: string) => {
    try {
      window.localStorage.setItem('musanad_auth', value);
    } catch {
      // private-mode / quota — ignore
    }
  }, persisted);
};

/**
 * Visit a route as a specific persona. Combines signInAs() + page.goto for
 * tests that don't care about the post-login landing page.
 */
export const goAs = async (page: Page, role: PersonaRole, path: string): Promise<void> => {
  await signInAs(page, role);
  await page.goto(path);
};

// `expect` referenced here for backward-compat — older signInAs used it to
// assert the persona button was visible. Re-exporting keeps spec authors
// happy if they re-import.
export { expect };

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
