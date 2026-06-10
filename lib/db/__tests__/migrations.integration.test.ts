import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from './rls-test-db';

/**
 * Migration M0 smoke. After the harness boots and applies migrations, the
 * `app_user` role must exist as a non-superuser holding USAGE on `public`, and a
 * probe connection made through `appConnUri` must land as that role with
 * superuser off — i.e. RLS will actually apply to it.
 */
describe('migration M0: app_user runtime role', () => {
  let db: Awaited<ReturnType<typeof startRlsTestDb>>;

  beforeAll(async () => {
    db = await startRlsTestDb();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('creates app_user as a non-superuser role', async () => {
    const { rows } = await db.admin.query(
      "select rolsuper from pg_roles where rolname = 'app_user'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rolsuper).toBe(false);
  });

  it('grants USAGE on schema public to app_user', async () => {
    const { rows } = await db.admin.query(
      "select has_schema_privilege('app_user', 'public', 'USAGE') as usage",
    );
    expect(rows[0].usage).toBe(true);
  });

  it('lets a probe connect via appConnUri as app_user with superuser off', async () => {
    const probe = new pg.Client({ connectionString: db.appConnUri });
    await probe.connect();
    try {
      const who = await probe.query('select current_user as who');
      expect(who.rows[0].who).toBe('app_user');
      const sup = await probe.query(
        "select current_setting('is_superuser') as is_superuser",
      );
      expect(sup.rows[0].is_superuser).toBe('off');
    } finally {
      await probe.end();
    }
  });
});
