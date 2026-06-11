import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { setupDb } from './db-setup';

/**
 * The `db:setup` contract: one call takes a VANILLA Postgres — no migrations,
 * `app_user` not loginable — to app-connectable. This is the exact gap that
 * broke the fresh-clone Quickstart: migrations create `app_user` with NOLOGIN
 * and no password ("LOGIN is env, not schema"), the test harnesses each
 * provisioned their own environment, and the dev path provisioned nothing —
 * so the app's first query died with `password authentication failed for user
 * "app_user"`. Deliberately NOT built on `startRlsTestDb`: that harness
 * already migrates and grants LOGIN, which would mask the behavior under test.
 */
describe('db:setup provisions a fresh database to app-connectable', () => {
  let container: StartedPostgreSqlContainer;
  let adminUrl: string;
  let appUrl: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
    adminUrl = container.getConnectionUri();
    appUrl = `postgresql://app_user:apppw@${container.getHost()}:${container.getMappedPort(
      5432,
    )}/${container.getDatabase()}`;
    await setupDb(adminUrl, appUrl);
  });

  afterAll(async () => {
    await container.stop();
  });

  /** Connects through `appUrl` and returns rows of `query`. */
  async function probeAsAppUser(query: string): Promise<pg.QueryResult> {
    const probe = new pg.Client({ connectionString: appUrl });
    await probe.connect();
    try {
      return await probe.query(query);
    } finally {
      await probe.end();
    }
  }

  it('makes the app DATABASE_URL authenticate as non-superuser app_user', async () => {
    const who = await probeAsAppUser(
      "select current_user as who, current_setting('is_superuser') as sup",
    );
    expect(who.rows[0].who).toBe('app_user');
    expect(who.rows[0].sup).toBe('off');
  });

  it('applies the drizzle migrations on the way (schema half of the contract)', async () => {
    // sign_in_log is migration-owned and granted to app_user; it being
    // queryable proves drizzle/ ran under the privileged role.
    const log = await probeAsAppUser('select count(*)::int as n from sign_in_log');
    expect(log.rows[0].n).toBe(0);
  });

  it('is idempotent — re-running against a provisioned database stays connectable', async () => {
    await setupDb(adminUrl, appUrl);
    const who = await probeAsAppUser('select current_user as who');
    expect(who.rows[0].who).toBe('app_user');
  });
});
