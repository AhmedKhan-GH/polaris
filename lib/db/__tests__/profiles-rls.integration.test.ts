import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isLiveDbReachable, LIVE_DB, liveDbGate } from './live-db';

/**
 * profiles RLS isolation, against the REAL local Supabase stack (`supabase
 * start`). The testcontainer can't host these: the `profiles_select_self` policy
 * calls `auth.uid()` and grants to the `authenticated` role, both of which exist
 * only on the Supabase stack. So this suite reaches for `:54322` directly.
 *
 * Gate: probe reachability, then {@link liveDbGate} decides. Unreachable + no
 * `CI_REQUIRE_LIVE_DB` → the suite skips (local dev without the stack up stays
 * green). Unreachable + `CI_REQUIRE_LIVE_DB` set → the gate THROWS here at
 * collection, failing loudly rather than skipping silently in CI.
 *
 * Per test we simulate the authenticated request path inside a transaction we
 * always ROLLBACK: `SET LOCAL ROLE authenticated` drops superuser (so RLS and
 * the grants actually bite), and `request.jwt.claims` feeds `auth.uid()` the
 * acting user's id. Seeding/teardown run as the superuser, which bypasses RLS.
 */
const reachable = await isLiveDbReachable();
const mode = liveDbGate(reachable, !!process.env.CI_REQUIRE_LIVE_DB);

const MEMBER_A = '1a000000-0000-0000-0000-000000000001';
const MEMBER_B = '1b000000-0000-0000-0000-000000000002';
const OWNER = '10000000-0000-0000-0000-000000000003';

/** Runs `body` as `authenticated` with `auth.uid()` = `uid`, then rolls back. */
async function asAuthenticated<T>(
  client: pg.Client,
  uid: string,
  body: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: uid, role: 'authenticated' })],
    );
    return await body();
  } finally {
    await client.query('ROLLBACK');
  }
}

describe.skipIf(mode === 'skip')('profiles RLS (live Supabase)', () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: LIVE_DB });
    await client.connect();
    // Seed as superuser (bypasses RLS). Upsert keeps reruns idempotent.
    for (const [id, role] of [
      [MEMBER_A, 'member'],
      [MEMBER_B, 'member'],
      [OWNER, 'owner'],
    ] as const) {
      await client.query(
        `insert into profiles (id, email, role) values ($1, $2, $3)
           on conflict (id) do update set role = excluded.role`,
        [id, `${role}@example.com`, role],
      );
    }
  });

  afterAll(async () => {
    if (!client) return;
    await client.query('delete from profiles where id = any($1)', [
      [MEMBER_A, MEMBER_B, OWNER],
    ]);
    await client.end();
  });

  it('MEMBER_A sees only their own row', async () => {
    const ids = await asAuthenticated(client, MEMBER_A, async () => {
      const { rows } = await client.query('select id from profiles');
      return rows.map((r) => r.id);
    });
    expect(ids).toEqual([MEMBER_A]);
  });

  it('OWNER sees only their own row (owner-reads-all deferred to F9)', async () => {
    // The self-read policy applies uniformly: an owner currently sees only
    // their own profile. A broader owner-reads-all policy is deliberately
    // deferred to F9 — implementing it as an RLS policy that reads `profiles`
    // to learn the caller's role would make the policy query `profiles`,
    // recursing through the same policy (infinite RLS recursion). F9 solves
    // this out-of-band (e.g. a SECURITY DEFINER role lookup), not here.
    const ids = await asAuthenticated(client, OWNER, async () => {
      const { rows } = await client.query('select id from profiles');
      return rows.map((r) => r.id);
    });
    expect(ids).toEqual([OWNER]);
  });

  it('rejects a self role escalation — write-lock denies, loudly', async () => {
    // The REVOKE (not RLS) denies the write, so it fails with a hard
    // "permission denied" rather than silently matching zero rows.
    await expect(
      asAuthenticated(client, MEMBER_A, async () => {
        await client.query(
          `update profiles set role = 'owner' where id = $1`,
          [MEMBER_A],
        );
      }),
    ).rejects.toThrow(/permission denied/i);

    // After rollback, a superuser read confirms the role never changed.
    const { rows } = await client.query(
      'select role from profiles where id = $1',
      [MEMBER_A],
    );
    expect(rows[0].role).toBe('member');
  });
});
