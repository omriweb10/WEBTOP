import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the *production* build served under /WEBTOP/, which is
 * exactly how GitHub Pages serves it (base path, manifest scope, service worker scope).
 */
const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/WEBTOP/`,
    trace: 'retain-on-failure',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },
  projects: [
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 15 Pro'],
        // Chromium stands in for WebKit in CI; viewport/touch/DPR still match the iPhone.
        browserName: 'chromium',
        viewport: { width: 402, height: 874 },
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}/WEBTOP/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
