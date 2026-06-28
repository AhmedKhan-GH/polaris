import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * user_preferences self-write RLS (ADR-0009), against a throwaway testcontainer.
 * Preferences are STRICTLY personal — a user reads and writes only their own row,
 * with NO owner branch (even an owner cannot see another user's row). Prod-shaped:
 * real withUserContext → real Drizzle client → real user_preferences schema.
 * Module-load order is the contract — boot the container and point DATABASE_URL at
 * the app_user URI BEFORE the dynamic imports.
 */
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const USER_C = '33333333-3333-3333-3333-333333333333';
const USER_D = '44444444-4444-4444-4444-444444444444';

describe('user_preferences self-write RLS (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db;
  let userPreferences: typeof import('@/lib/db/schema/preferences').userPreferences;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
    ({ userPreferences } = await import('@/lib/db/schema/preferences'));

    // Seed as superuser (bypasses RLS): A and B each already have a row.
    await rls.admin.query(
      `insert into user_preferences (user_id, timezone, hour12) values ($1, 'America/New_York', true)`,
      [USER_A],
    );
    await rls.admin.query(
      `insert into user_preferences (user_id, timezone, hour12) values ($1, 'Europe/London', false)`,
      [USER_B],
    );
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it('a user reads ONLY their own row (USING: self)', async () => {
    const rows = await withUserContext({ userId: USER_A, roles: ['member'] }, (tx) =>
      tx.select().from(userPreferences),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(USER_A);
    expect(rows[0].timezone).toBe('America/New_York');
  });

  it('even an owner sees only their own row (no owner branch)', async () => {
    const rows = await withUserContext({ userId: USER_A, roles: ['owner'] }, (tx) =>
      tx.select().from(userPreferences),
    );
    expect(rows.map((r) => r.userId)).toEqual([USER_A]); // USER_B is invisible
  });

  it('a user inserts their OWN row (WITH CHECK: self)', async () => {
    await withUserContext({ userId: USER_C, roles: ['member'] }, (tx) =>
      tx
        .insert(userPreferences)
        .values({ userId: USER_C, timezone: 'Asia/Tokyo', hour12: false }),
    );
    const { rows } = await rls.admin.query(
      'select timezone from user_preferences where user_id = $1',
      [USER_C],
    );
    expect(rows).toEqual([{ timezone: 'Asia/Tokyo' }]);
  });

  it('rejects inserting a row owned by someone else (WITH CHECK)', async () => {
    const rejection = await withUserContext({ userId: USER_A, roles: ['owner'] }, (tx) =>
      tx
        .insert(userPreferences)
        .values({ userId: USER_D, timezone: 'Asia/Tokyo', hour12: false }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);
  });

  it('a user updates their own row', async () => {
    await withUserContext({ userId: USER_A, roles: ['member'] }, (tx) =>
      tx
        .update(userPreferences)
        .set({ timezone: 'America/Chicago' })
        .where(eq(userPreferences.userId, USER_A)),
    );
    const { rows } = await rls.admin.query(
      'select timezone from user_preferences where user_id = $1',
      [USER_A],
    );
    expect(rows).toEqual([{ timezone: 'America/Chicago' }]);
  });

  it("cannot touch another user's row (USING hides it; the update is a no-op)", async () => {
    await withUserContext({ userId: USER_A, roles: ['owner'] }, (tx) =>
      tx
        .update(userPreferences)
        .set({ timezone: 'HACKED' })
        .where(eq(userPreferences.userId, USER_B)),
    );
    const { rows } = await rls.admin.query(
      'select timezone from user_preferences where user_id = $1',
      [USER_B],
    );
    expect(rows).toEqual([{ timezone: 'Europe/London' }]); // unchanged
  });
});
