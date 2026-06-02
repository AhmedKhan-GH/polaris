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
  },
})
