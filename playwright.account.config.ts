import { defineConfig, devices } from '@playwright/test';

/**
 * Account-mode end-to-end tests: the production build talks to the local
 * Supabase-equivalent stack (start it first with `npm run stack`).
 */
const PORT = 4174;

export default defineConfig({
  testDir: 'tests/e2e-account',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-account' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/WEBTOP/`,
    trace: 'retain-on-failure',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    // Service workers would cache API-free shells between tests; not needed here.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 15 Pro'],
        browserName: 'chromium',
        viewport: { width: 402, height: 874 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: `node scripts/local-stack/build-account.mjs && npx vite preview --outDir dist-account --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/WEBTOP/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
