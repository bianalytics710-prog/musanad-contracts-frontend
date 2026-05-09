/**
 * M7 (CR-A) — OSINT Source Framework + Adapter Protocol — E2E spec.
 *
 * Codifies the post-impl Playwright walk that verified all 11 brief ACs
 * end-to-end against a running BE+FE stack. Re-run via:
 *   npx playwright test tests/e2e/M7-admin-sources.spec.ts
 *
 * Pre-conditions (one-time setup):
 *   - BE running on http://localhost:4000 with DATABASE_URL pointed at the
 *     m0-foundation Neon branch (or test branch — both at version 108)
 *   - FE running on http://localhost:5173 (Vite dev)
 *   - Workers default-disabled in dev; this spec exercises the API surface
 *     directly (test-pull endpoint), not the cron worker
 *
 * Persona: platform_admin (Omar Al Mansoori). Run by persona via
 *   npx playwright test --grep @persona-platform_admin
 */
import { test, expect } from '@playwright/test';
import { signInAs } from './helpers';

test.describe('M7 — OSINT Source Framework + Adapter Protocol (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'platform_admin');
  });

  // AC-S10-01 [e2e] @persona-platform_admin — Sources list page loads
  test('AC-S10-01 [e2e] @persona-platform_admin — sources list shows 13 ADNOC seed sources', async ({ page }) => {
    await page.goto('/app/admin/sources');
    await expect(page.getByRole('heading', { name: 'Sources', level: 1 })).toBeVisible();
    await expect(page.getByText(/Total:\s*13/)).toBeVisible();
    // Health summary tile present
    await expect(page.getByText(/^Healthy$/).first()).toBeVisible();
    await expect(page.getByText(/^Failing$/).first()).toBeVisible();
    await expect(page.getByText(/^Unauthorised$/).first()).toBeVisible();
  });

  // AC-S10-04 [e2e] — Filter by kind=Sanctions narrows to 4
  test('AC-S10-04 [e2e] @persona-platform_admin — kind filter works', async ({ page }) => {
    await page.goto('/app/admin/sources');
    await expect(page.getByText(/Total:\s*13/)).toBeVisible();
    const kindSelect = page.getByLabel(/^Kind$/i).first();
    await kindSelect.selectOption('sanctions');
    await expect(page.getByText(/Total:\s*4/)).toBeVisible({ timeout: 10_000 });
  });

  // AC-S10-01 [e2e] — Detail page renders with source-id immutable hint + form fields
  test('AC-S10-01 [e2e] @persona-platform_admin — detail page renders OFAC SDN with immutable sourceId', async ({ page }) => {
    await page.goto('/app/admin/sources/1');
    await expect(page.getByRole('heading', { name: 'OFAC SDN List', level: 1 })).toBeVisible();
    const sourceIdInput = page.getByLabel('Source ID');
    await expect(sourceIdInput).toBeDisabled();
    await expect(sourceIdInput).toHaveValue('ofac_sdn');
    await expect(page.getByText(/Source ID is immutable/)).toBeVisible();
    // Health region present with the standard 3 fields
    await expect(page.getByText('Last success', { exact: true })).toBeVisible();
    await expect(page.getByText('Last failure', { exact: true })).toBeVisible();
    await expect(page.getByText('Signals (24h)', { exact: true })).toBeVisible();
  });

  // AC-S7-06 [e2e] — Test pull endpoint queues a manual fetch
  test('AC-S7-06 [e2e] @persona-platform_admin — test pull button hits backend', async ({ page }) => {
    await page.goto('/app/admin/sources/1');
    const testPullBtn = page.getByRole('button', { name: 'Test pull' });
    await expect(testPullBtn).toBeEnabled();
    // Capture the BE response on the network channel
    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/v1/admin/sources/1/test-pull') && r.request().method() === 'POST',
    );
    await testPullBtn.click();
    const resp = await respPromise;
    expect(resp.status()).toBe(202);
    const body = await resp.json();
    expect(body).toMatchObject({ queued: true, sourceId: 'ofac_sdn' });
  });

  // AC-S3-01 [e2e] — Add source dialog opens with form fields
  test('AC-S3-01 [e2e] @persona-platform_admin — Add source dialog opens', async ({ page }) => {
    await page.goto('/app/admin/sources');
    await page.getByRole('button', { name: 'Add source' }).click();
    await expect(page.getByRole('heading', { name: /Add OSINT source/i })).toBeVisible();
    await expect(page.getByLabel(/Source ID/i).first()).toBeVisible();
    await expect(page.getByLabel(/Display name$/i).first()).toBeVisible();
    await expect(page.getByLabel(/URL/i).first()).toBeVisible();
  });

  // AC-S9-01 [e2e] — Source health monitor renders dedicated page
  test('AC-S9-01 [e2e] @persona-platform_admin — /admin/source-health page renders', async ({ page }) => {
    await page.goto('/app/admin/source-health');
    await expect(page.getByRole('heading', { name: 'Source health', level: 1 })).toBeVisible();
    await expect(page.getByText(/health-check cron/i)).toBeVisible();
  });

  // AC-S3-04 [e2e] — credentialRef NEVER appears in any GET response body
  test('AC-S3-04 [e2e] @persona-platform_admin — credential field is write-only', async ({ page }) => {
    await page.goto('/app/admin/sources/1');
    // Inspect the GET /sources/:id response bodies for any credentialRef leak
    const apiResponses: string[] = [];
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/v1/admin/sources/1') && resp.request().method() === 'GET') {
        try { apiResponses.push(await resp.text()); } catch { /* binary */ }
      }
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'OFAC SDN List' })).toBeVisible();
    for (const body of apiResponses) {
      expect(body, 'credentialRef must NEVER leak via GET').not.toMatch(/credentialRef/i);
    }
  });
});

test.describe('M7 — role gating', () => {
  // AC-S8-06 [e2e] @persona-legal_counsel — legal_counsel cannot access /admin/sources
  test('AC-S8-06 [e2e] @persona-legal_counsel — legal_counsel denied /admin/sources via API', async ({ page }) => {
    await signInAs(page, 'legal_counsel');
    const beUrl = process.env['E2E_BE_BASE_URL'] ?? 'http://localhost:4000';
    const accessToken = await page.evaluate(() => localStorage.getItem('auth.accessToken') ?? '');
    const resp = await page.request.get(`${beUrl}/api/v1/admin/sources`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    expect(resp.status()).toBe(403);
  });

  // AC-S11-01 [e2e] @persona-legal_counsel — legal_counsel CAN list signals
  test('AC-S11-01 [e2e] @persona-legal_counsel — legal_counsel allowed /signals', async ({ page }) => {
    await signInAs(page, 'legal_counsel');
    const beUrl = process.env['E2E_BE_BASE_URL'] ?? 'http://localhost:4000';
    const accessToken = await page.evaluate(() => localStorage.getItem('auth.accessToken') ?? '');
    const resp = await page.request.get(`${beUrl}/api/v1/signals`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    expect(resp.status()).toBe(200);
  });
});
