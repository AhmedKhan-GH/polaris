import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Vite 8 (bundled with Vitest 4) resolves tsconfig `paths` natively via
  // `resolve.tsconfigPaths`, so the `vite-tsconfig-paths` plugin is unnecessary.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    exclude: [
      'node_modules',
      'docs',
      '.next',
      'e2e',
      '**/*.integration.test.ts',
    ],
    passWithNoTests: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
