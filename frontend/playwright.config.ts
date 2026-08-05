import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests.
 *
 * These walk the four journeys the submission email has to answer for — a
 * completed order, a decline, a timeout, and a provider failure rescued by an
 * admin — through the real UI, against the real database and the real mock
 * provider.
 *
 * Point BASE_URL at the deployed site to run them against production:
 *   BASE_URL=https://your-app.vercel.app pnpm e2e
 */
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  // Orders wait on an asynchronous callback and up to three retries, so give
  // them room. A tight timeout here fails for the wrong reason.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  // These share one database and one finite eSIM pool. Parallel workers would
  // interfere with each other's stock.
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000/plans',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
