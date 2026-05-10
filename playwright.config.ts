/**
 * Playwright E2E config for the Musanad Contracts frontend.
 *
 * Tests assume the BE runs on http://localhost:4000 and the FE on
 * http://localhost:5173. The Testing Agent spawns specs at
 * `tests/e2e/M[N]-*.spec.ts`; persona quick-sign-in is reused via
 * `tests/e2e/helpers.ts`.
 *
 * Run once before first invocation:
 *   npx playwright install chromium
 *
 * Run all E2E:
 *   npx playwright test
 *
 * Run a single module:
 *   npx playwright test tests/e2e/M7-*.spec.ts
 *
 * Run by persona:
 *   npx playwright test --grep @persona-platform_admin
 */
import { defineConfig, devices } from '@playwright/test';

const FE_BASE_URL = process.env.E2E_FE_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(M\d+|CR-[A-Z]+).*\.spec\.ts$/,
  fullyParallel: false, // tests touch a shared test DB; serial keeps state predictable
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/playwright-report' }]],
  outputDir: 'test-results/playwright-artifacts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FE_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
    locale: 'en',
    timezoneId: 'Asia/Dubai',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
