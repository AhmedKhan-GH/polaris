import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    include: ['tests/**/*.test.ts'],
  },
})
