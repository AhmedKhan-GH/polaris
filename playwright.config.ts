import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// Load the committed local test env (Supabase demo keys, DATABASE_URL, the seed
// user creds). `dotenv` is already a devDep; Playwright's own config module is
// the right place to read it, because global-setup and the specs both rely on
// these values being present in `process.env` before anything boots.
loadEnv({ path: '.env.test' });

/**
 * End-to-end harness. Runs serially against a freshly-booted dev server on
 * :3000 (never reusing a stray one) so every run starts from a known process,
 * with global-setup migrating + seeding the live local Supabase stack first.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
  },
});
