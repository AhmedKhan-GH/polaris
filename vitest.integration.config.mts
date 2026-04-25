import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    reporters: ['verbose'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    include: ['**/*.integration.test.ts'],
    exclude: [...configDefaults.exclude, 'dump/**'],
  },
})
