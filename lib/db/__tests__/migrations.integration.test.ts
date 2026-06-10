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

/**
 * Migration M1 smoke. The `profiles` table must materialise with exactly its
 * four columns (in order) and have row-level security switched on. Crucially,
 * this runs on a VANILLA Postgres container with no `auth` schema: the policy
 * and grant/revoke live behind `IF EXISTS (... schema_name = 'auth')` guards, so
 * here they must no-op — the absence of a `profiles_select_self` policy row is
 * the proof the guard actually fired (rather than erroring on the missing
 * `auth.uid()`), keeping the migration portable to plain Postgres.
 */
describe('migration M1: profiles role source of truth', () => {
  let db: Awaited<ReturnType<typeof startRlsTestDb>>;

  beforeAll(async () => {
    db = await startRlsTestDb();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('creates profiles with exactly (id uuid, email text, role text, created_at timestamptz) in order', async () => {
    const { rows } = await db.admin.query(
      `select column_name, data_type
         from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles'
        order by ordinal_position`,
    );
    expect(rows).toEqual([
      { column_name: 'id', data_type: 'uuid' },
      { column_name: 'email', data_type: 'text' },
      { column_name: 'role', data_type: 'text' },
      { column_name: 'created_at', data_type: 'timestamp with time zone' },
    ]);
  });

  it('enables row level security on profiles', async () => {
    const { rows } = await db.admin.query(
      "select relrowsecurity from pg_class where relname = 'profiles'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].relrowsecurity).toBe(true);
  });

  it('no-ops the auth-guarded blocks: no profiles_select_self policy on a vanilla container', async () => {
    const { rows } = await db.admin.query(
      "select policyname from pg_policies where tablename = 'profiles'",
    );
    expect(rows).toEqual([]);
  });
});
