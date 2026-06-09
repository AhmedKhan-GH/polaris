import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['**/*.integration.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    passWithNoTests: true,
    // The integration config doesn't load .env files; tests that import
    // lib/db/client trigger t3-env validation, which requires the Supabase client
    // vars. DATABASE_URL is set per-test (testcontainer URI) before that import.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
