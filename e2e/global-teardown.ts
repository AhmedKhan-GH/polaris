import { execSync } from 'node:child_process'

// Remove the ephemeral E2E database container after the run (local only).
export default async function globalTeardown() {
  if (!process.env.CI) {
    try {
      execSync('docker rm -f polaris-e2e-db', { stdio: 'ignore' })
    } catch {
      // ignore — nothing to clean up
    }
  }
}
