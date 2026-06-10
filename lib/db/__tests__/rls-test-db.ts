import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/**
 * Boots a throwaway Postgres container for integration tests, applies the
 * Drizzle migrations, and prepares a non-superuser application login.
 *
 * The returned `admin` pool connects as the container superuser, which bypasses
 * RLS — use it for setup and assertions. `appConnUri` is a connection string
 * for the migration-created `app_user` role (granted LOGIN here, an environment
 * concern that never belongs in a migration); connections made through it are
 * subject to RLS, so policies can actually be exercised.
 */
export async function startRlsTestDb(): Promise<{
  container: StartedPostgreSqlContainer;
  admin: pg.Pool;
  appConnUri: string;
  cleanup(): Promise<void>;
}> {
  const container = await new PostgreSqlContainer('postgres:17').start();
  const admin = new pg.Pool({ connectionString: container.getConnectionUri() });

  // Apply migrations as the superuser (CREATE ROLE / GRANT need the privilege).
  await migrate(drizzle(admin), { migrationsFolder: './drizzle' });

  // LOGIN + password are environment, not schema, so they live here rather than
  // in a migration. This makes app_user connectable for RLS exercises.
  await admin.query("ALTER ROLE app_user WITH LOGIN PASSWORD 'apppw'");

  const appConnUri = `postgresql://app_user:apppw@${container.getHost()}:${container.getMappedPort(
    5432,
  )}/${container.getDatabase()}`;

  return {
    container,
    admin,
    appConnUri,
    async cleanup() {
      await admin.end();
      await container.stop();
    },
  };
}
