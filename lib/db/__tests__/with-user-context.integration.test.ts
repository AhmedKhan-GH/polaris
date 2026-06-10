import { sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from './rls-test-db';

/**
 * withUserContext GUC plumbing against a real Postgres.
 *
 * Module-load order is the contract here: `lib/db/client` reads `DATABASE_URL`
 * at import time, so this suite OWNS the first real import of it. We boot the
 * container, point `DATABASE_URL` at the `app_user` connection string, and only
 * THEN dynamically import the unit — importing earlier would bind the client to
 * the wrong (or missing) URL.
 *
 * Two things are proven: (1) inside the callback the transaction-scoped GUCs are
 * visible with the expected values, and (2) after the call returns, a separate
 * probe on the same pool sees them cleared — nothing leaks onto a recycled
 * connection.
 */
const A = '11111111-1111-1111-1111-111111111111';

describe('withUserContext GUC plumbing (integration)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    // Dynamic import AFTER env is set: the client binds to DATABASE_URL on load.
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
  });

  afterAll(async () => {
    // End the app pool the client opened so it does not hold the event loop,
    // then tear the container down.
    await db.$client.end();
    await rls.cleanup();
  });

  it('exposes the scoped GUCs inside the transaction', async () => {
    const settings = await withUserContext(
      { userId: A, roles: ['owner'] },
      async (tx) => {
        const { rows } = await tx.execute(
          sql`select current_setting('app.user_id', true) as uid, current_setting('app.user_roles', true) as roles`,
        );
        return rows[0] as { uid: string; roles: string };
      },
    );

    expect(settings.uid).toBe(A);
    expect(settings.roles).toBe('["owner"]');
  });

  it('leaves no GUCs set after the transaction commits', async () => {
    await withUserContext({ userId: A, roles: ['owner'] }, async () => undefined);

    // Separate probe on the same pool: transaction-scoped settings must be gone.
    const probe = new pg.Client({ connectionString: rls.appConnUri });
    await probe.connect();
    try {
      const { rows } = await probe.query(
        "select current_setting('app.user_id', true) as uid, current_setting('app.user_roles', true) as roles",
      );
      expect(rows[0].uid === '' || rows[0].uid === null).toBe(true);
      expect(rows[0].roles === '' || rows[0].roles === null).toBe(true);
    } finally {
      await probe.end();
    }
  });
});
