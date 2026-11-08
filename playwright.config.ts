import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the production build (CSP included).
 * CI runs all three engines; locally `npm run e2e -- --project=chromium` is enough.
 * Set PW_CHROMIUM_PATH to use an already installed Chromium.
 */
const chromiumPath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    acceptDownloads: true,
  },
  webServer: {
    command: 'npm run build && npm run preview -w @svs/web -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: chromiumPath ? { executablePath: chromiumPath } : {} } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], launchOptions: chromiumPath ? { executablePath: chromiumPath } : {} }, testMatch: /mobile\.spec\.ts/ },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] }, testMatch: /mobile\.spec\.ts/ },
    { name: 'tablet-safari', use: { ...devices['iPad Pro 11'] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
