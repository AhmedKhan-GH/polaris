import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

export interface RlsTestDb {
  container: StartedPostgreSqlContainer
  /** App connection — as the non-superuser `app_user` role itself (= prod). */
  appConnUri: string
  /** Superuser pool for migrations/seeding (bypasses RLS). */
  admin: pg.Pool
  cleanup: () => Promise<void>
}

// Starts a migrated Postgres whose *app* connection is the non-superuser
// `app_user` role itself — the SAME role prod uses. `current_user = app_user`,
// so the RLS policy applies natively (no SET ROLE). Migrations/seeding use the
// superuser `admin` pool. A superuser app connection would bypass RLS and mask
// bugs — this makes that impossible.
//
// Usage: set `process.env.DATABASE_URL = appConnUri` BEFORE importing
// `@/lib/db/client`, seed via `admin`, and call `cleanup()` in afterAll.
export async function startRlsTestDb(): Promise<RlsTestDb> {
  const container = await new PostgreSqlContainer('postgres:17').start()
  const admin = new pg.Pool({ connectionString: container.getConnectionUri() })

  await migrate(drizzle(admin), { migrationsFolder: './drizzle' })
  // app_user is created by the migration as a NOLOGIN policy target. Make it the
  // app's login role (env setup, not a migration — passwords aren't schema) so
  // the app connects AS app_user.
  await admin.query(`ALTER ROLE app_user WITH LOGIN PASSWORD 'apppw'`)

  const appConnUri = `postgresql://app_user:apppw@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`

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
