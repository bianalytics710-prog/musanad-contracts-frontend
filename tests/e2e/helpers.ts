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
  | 'executive'
  | 'operations'
  | 'finance_treasury'
  | 'compliance_esg';

export const PERSONA_BUTTON_NAME: Record<PersonaRole, RegExp> = {
  super_admin: /Bootstrap Admin/i,
  platform_admin: /Omar Al Mansoori/i,
  legal_counsel: /Layla Counsel/i,
  contract_drafter: /Dana Drafter/i,
  contract_approver: /Aisha Approver/i,
  contract_recipient: /Rashid Recipient/i,
  executive: /Eman Executive/i,
  // Unit-3 personas (seeded by migration 191)
  operations: /Omar Operations/i,
  finance_treasury: /Fatima Finance/i,
  compliance_esg: /Khalid Compliance/i,
};

const PERSONA_EMAIL: Record<PersonaRole, string> = {
  super_admin: 'admin@musanad.local',
  platform_admin: 'platform.admin@musanad.local',
  legal_counsel: 'legal@musanad.local',
  contract_drafter: 'drafter@musanad.local',
  contract_approver: 'approver@musanad.local',
  contract_recipient: 'recipient@musanad.local',
  executive: 'executive@musanad.local',
  operations: 'operations@musanad.local',
  finance_treasury: 'finance@musanad.local',
  compliance_esg: 'compliance@musanad.local',
};

/**
 * Sign in by clicking the role's dev-quick-sign-in persona tile. Uses
 * `force: true` so the click lands regardless of fold position (Unit-3 personas
 * sit in row 5 of the 5-row persona grid at the 1280×800 viewport and may not
 * be scrolled into view by Playwright's auto-scroll heuristic).
 *
 * Why not seed localStorage directly? TanStack Start uses Cloudflare Workers
 * SSR — the `/app/*` route guard's `beforeLoad` fires server-side on initial
 * navigation, where localStorage doesn't exist. A client-side login through
 * the tile triggers a client-side navigation that the auth-aware guard
 * permits.
 */
export const signInAs = async (page: Page, role: PersonaRole): Promise<void> => {
  await page.goto('/auth/login');
  // Wait for the React bundle to fully hydrate. TanStack Start uses Cloudflare
  // Workers SSR, so the initial HTML response is server-rendered; React event
  // handlers (including the persona-tile onClick + react-hook-form onSubmit)
  // are only bound AFTER the client bundle loads and hydrates. Clicking before
  // hydration would either no-op or fall through to native HTML form GET.
  // We wait for networkidle (the bundle script finished loading + executed)
  // then briefly for handlers to attach.
  await page.waitForLoadState('networkidle');
  // Wait for the persona-tile section to be interactive — its presence implies
  // the React tree mounted and event delegation is in place.
  await page.getByText(/DEV QUICK SIGN-IN/i).waitFor({ state: 'visible', timeout: 15000 });

  const pattern = PERSONA_BUTTON_NAME[role].source;
  // Dispatch a native DOM click via page.evaluate — viewport-independent and
  // bypasses Playwright's auto-scroll heuristic that misjudged Unit-3 tiles
  // (row 5 of the 5-row persona grid at 1280×800) as already visible.
  const clicked = await page.evaluate((re) => {
    const regex = new RegExp(re, 'i');
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      regex.test(b.textContent ?? ''),
    );
    if (!button) return false;
    button.click();
    return true;
  }, pattern);
  if (!clicked) {
    throw new Error(`signInAs(${role}): persona tile not found matching /${pattern}/i`);
  }
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 15000 });
};

function roleLanding(role: PersonaRole): string {
  switch (role) {
    case 'contract_approver':
      return '/app/approvals';
    case 'contract_drafter':
      return '/app/dashboards/drafter';
    case 'legal_counsel':
      return '/app/dashboards/legal-counsel';
    case 'executive':
      return '/app/dashboards/executive';
    case 'contract_recipient':
      return '/app/dashboards/recipient';
    case 'platform_admin':
    case 'super_admin':
      return '/app/admin';
    case 'operations':
      return '/app/dashboards/operations';
    case 'finance_treasury':
      return '/app/dashboards/finance-treasury';
    case 'compliance_esg':
      return '/app/dashboards/compliance-esg';
    default:
      return '/app';
  }
}

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
