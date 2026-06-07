import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.test' })

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
    // Always launch a dedicated app instance so it uses the isolated E2E
    // DATABASE_URL (from .env.test) — never a stray dev server on the dev DB.
    reuseExistingServer: false,
  },
})
