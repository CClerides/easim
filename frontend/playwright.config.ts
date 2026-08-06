import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// These tests talk to the real project, so they need the same .env.local the
// dev server uses - the teardown cannot give stock back without the secret key.
loadEnv({ path: '.env.local', quiet: true })

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
  globalSetup: './e2e/global-setup.ts',
  // Buying through the UI consumes eSIMs from a finite pool. Without this the
  // suite drains the shop and later runs fail on out-of-stock rather than on
  // anything real.
  globalTeardown: './e2e/global-teardown.ts',
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
