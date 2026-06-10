import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from './rls-test-db';

/**
 * sign_in_log RLS isolation, against a throwaway testcontainer (not the live
 * stack: this policy targets `app_user` and the `app.user_roles` GUC, both of
 * which the vanilla container has after migrations — no Supabase `auth` schema
 * is needed).
 *
 * Mechanics note: this suite drives RLS on the ADMIN (superuser) pool by
 * `set role app_user` to drop the bypass, then `select set_config(
 * 'app.user_roles', <json>, false)` to publish the acting roles at SESSION scope,
 * and `reset role` between cases. This is DELIBERATELY different from
 * withUserContext's transaction-scoped pattern: here each case needs precise,
 * independent control over the role AND the GUC on one connection, so we manage
 * them by hand rather than through the app's transaction helper. Seeding runs
 * before any `set role`, as the superuser, which bypasses RLS.
 */
const SEED_USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SEED_EMAIL = 'seed@example.com';
const WRITTEN_USER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const WRITTEN_EMAIL = 'written@example.com';

describe('sign_in_log RLS (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    // Seed as superuser (bypasses RLS) before any role switch.
    await rls.admin.query(
      'insert into sign_in_log (user_id, email) values ($1, $2)',
      [SEED_USER, SEED_EMAIL],
    );
  });

  afterAll(async () => {
    await rls.cleanup();
  });

  /** Runs `body` as `app_user` with the given roles GUC, then resets the role. */
  async function asAppUser<T>(
    rolesJson: string,
    body: () => Promise<T>,
  ): Promise<T> {
    await rls.admin.query('set role app_user');
    await rls.admin.query(
      `select set_config('app.user_roles', $1, false)`,
      [rolesJson],
    );
    try {
      return await body();
    } finally {
      await rls.admin.query('reset role');
    }
  }

  it('hides the seeded row from a member', async () => {
    const rows = await asAppUser('["member"]', async () => {
      const { rows } = await rls.admin.query(
        `select email from sign_in_log where email = $1`,
        [SEED_EMAIL],
      );
      return rows;
    });
    expect(rows).toHaveLength(0);
  });

  it('shows the seeded row to an owner', async () => {
    const rows = await asAppUser('["owner"]', async () => {
      const { rows } = await rls.admin.query(
        `select email from sign_in_log where email = $1`,
        [SEED_EMAIL],
      );
      return rows;
    });
    expect(rows).toEqual([{ email: SEED_EMAIL }]);
  });

  it('lets app_user INSERT a sign-in with no roles context (WITH CHECK true)', async () => {
    await asAppUser('[]', async () => {
      await rls.admin.query(
        `insert into sign_in_log (user_id, email) values ($1, $2)`,
        [WRITTEN_USER, WRITTEN_EMAIL],
      );
    });

    // Back as superuser: the row landed despite the empty roles GUC at write.
    const { rows } = await rls.admin.query(
      `select user_id, email from sign_in_log where email = $1`,
      [WRITTEN_EMAIL],
    );
    expect(rows).toEqual([{ user_id: WRITTEN_USER, email: WRITTEN_EMAIL }]);
  });
});
