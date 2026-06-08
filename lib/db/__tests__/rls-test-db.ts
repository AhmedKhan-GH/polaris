import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

export interface RlsTestDb {
  container: StartedPostgreSqlContainer
  /** Non-superuser connection (member of app_user) — what the *app* should use. */
  appConnUri: string
  /** Superuser pool for migrations/seeding (bypasses RLS). */
  admin: pg.Pool
  cleanup: () => Promise<void>
}

// Starts a migrated Postgres whose *app* connection is a NON-SUPERUSER member of
// app_user — mirroring dev/prod. App-path integration tests must use this: a
// superuser connection masks RLS (bypass) and the SET ROLE membership
// requirement. Migrations and seeding use the superuser `admin` pool.
//
// Usage: set `process.env.DATABASE_URL = appConnUri` BEFORE importing
// `@/lib/db/client`, seed via `admin`, and call `cleanup()` in afterAll.
export async function startRlsTestDb(): Promise<RlsTestDb> {
  const container = await new PostgreSqlContainer('postgres:17').start()
  const admin = new pg.Pool({ connectionString: container.getConnectionUri() })

  await migrate(drizzle(admin), { migrationsFolder: './drizzle' })
  // The app connection: non-superuser, made a member of app_user (env setup).
  await admin.query(`CREATE ROLE app_conn LOGIN PASSWORD 'connpw' NOSUPERUSER`)
  await admin.query(`GRANT "app_user" TO app_conn`)

  const appConnUri = `postgresql://app_conn:connpw@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`

  return {
    container,
    appConnUri,
    admin,
    cleanup: async () => {
      await admin.end()
      await container.stop()
    },
  }
}
