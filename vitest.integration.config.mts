import { defineConfig } from 'vitest/config';

// Integration suite: real services via Testcontainers. No React plugin and no
// jsdom — these tests run in the default Node environment. This config also does
// NOT load `.env` files; the two NEXT_PUBLIC_* vars below are injected solely to
// satisfy future env validation when later tests import `lib/db/client`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['**/*.integration.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    passWithNoTests: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
