import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import pg from 'pg';

/**
 * Boots a throwaway Postgres container for integration tests.
 *
 * The returned `admin` pool connects as the container superuser, which bypasses
 * RLS. A non-superuser application connection (plus migrations) arrives in
 * Task 9 so that policies can actually be exercised.
 */
export async function startRlsTestDb(): Promise<{
  container: StartedPostgreSqlContainer;
  admin: pg.Pool;
  cleanup(): Promise<void>;
}> {
  const container = await new PostgreSqlContainer('postgres:17').start();
  const admin = new pg.Pool({ connectionString: container.getConnectionUri() });

  return {
    container,
    admin,
    async cleanup() {
      await admin.end();
      await container.stop();
    },
  };
}
