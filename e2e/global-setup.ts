import { execSync } from 'node:child_process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

const CONTAINER = 'polaris-e2e-db'

// Prepares an ISOLATED, migrated database for the E2E run so tests never touch
// the dev DB. Locally: spin a fresh throwaway Postgres on the DATABASE_URL port.
// In CI: a postgres service is already provided, so just migrate it.
export default async function globalSetup() {
  await assertKeycloakReachable()

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is not set (.env.test)')

  if (!process.env.CI) {
    const port = new URL(databaseUrl).port || '5432'
    execSync(`docker rm -f ${CONTAINER}`, { stdio: 'ignore' })
    execSync(
      `docker run -d --name ${CONTAINER} ` +
        `-e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres ` +
        `-p ${port}:5432 postgres:17`,
      { stdio: 'ignore' },
    )
    await waitForPostgres(databaseUrl)
  }

  // Migrate (idempotent) — the E2E DB is always built from the same migrations
  // as prod, so its structure can't drift.
  const pool = new pg.Pool({ connectionString: databaseUrl })
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  } finally {
    await pool.end()
  }
}

async function assertKeycloakReachable() {
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER
  if (!issuer) throw new Error('AUTH_KEYCLOAK_ISSUER is not set (.env.test)')
  const discovery = `${issuer}/.well-known/openid-configuration`
  const res = await fetch(discovery).catch((e) => {
    throw new Error(
      `Keycloak not reachable at ${discovery} — run \`docker compose up -d\`. (${e})`,
    )
  })
  if (!res.ok) throw new Error(`Keycloak discovery returned ${res.status}`)
}

async function waitForPostgres(connectionString: string) {
  for (let i = 0; i < 30; i++) {
    const client = new pg.Client({ connectionString })
    try {
      await client.connect()
      await client.end()
      return
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error('E2E Postgres did not become ready')
}
