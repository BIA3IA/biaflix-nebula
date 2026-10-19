import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contro l'istanza Jellyfin 12.2 LOCALE (pnpm dev:up && pnpm dev:seed), mai la produzione.
 * Firefox desktop è obbligatorio; Chromium per laptop 1366×768 e mobile.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.NEBULA_DEV_URL ?? 'http://127.0.0.1:8097',
    trace: 'retain-on-failure',
    locale: 'it-IT',
    colorScheme: 'dark',
  },
  projects: [
    { name: 'firefox-1080p', use: { ...devices['Desktop Firefox'], viewport: { width: 1920, height: 1080 } } },
    { name: 'chromium-1366', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
