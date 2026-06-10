import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * notes ownership-RLS isolation, against a throwaway testcontainer. Like the
 * sign_in_log suite, the policy targets `app_user` and the `app.user_*` GUCs,
 * which the vanilla container has after migrations — no Supabase `auth` schema
 * is needed.
 *
 * This suite is deliberately PROD-SHAPED: it exercises the real
 * `withUserContext` helper through the real Drizzle client and the real `notes`
 * schema — the exact pipeline a request action will use — rather than driving
 * RLS by hand. Module-load order is the contract: `lib/db/client` reads
 * `DATABASE_URL` at import time, so this suite OWNS the first real import of it.
 * We boot the container, point `DATABASE_URL` at the `app_user` connection
 * string, and only THEN dynamically import the client/schema/helper; importing
 * earlier would bind the client to the wrong (or missing) URL.
 *
 * Seeding runs on the `admin` (superuser) pool, which bypasses RLS.
 */
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

describe('notes ownership RLS (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db;
  let notes: typeof import('@/app/_features/notes/schema').notes;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    // Dynamic import AFTER env is set: the client binds to DATABASE_URL on load.
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
    ({ notes } = await import('@/app/_features/notes/schema'));

    // Seed as superuser (bypasses RLS): one note per owner.
    await rls.admin.query(
      'insert into notes (created_by, body) values ($1, $2), ($3, $4)',
      [USER_A, 'a', USER_B, 'b'],
    );
  });

  afterAll(async () => {
    // End the app pool the client opened so it does not hold the event loop,
    // then tear the container down.
    await db.$client.end();
    await rls.cleanup();
  });

  it('shows USER_A only their own note (USING: own rows)', async () => {
    const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.select().from(notes),
    );
    expect(rows.map((r) => r.body)).toEqual(['a']);
    expect(rows.map((r) => r.createdBy)).toEqual([USER_A]);
  });

  it('shows USER_B only their own note (USING: own rows)', async () => {
    const rows = await withUserContext({ userId: USER_B, roles: [] }, (tx) =>
      tx.select().from(notes),
    );
    expect(rows.map((r) => r.body)).toEqual(['b']);
    expect(rows.map((r) => r.createdBy)).toEqual([USER_B]);
  });

  it('shows an owner ALL notes (USING: owner-role read-all branch)', async () => {
    const rows = await withUserContext(
      { userId: USER_B, roles: ['owner'] },
      (tx) => tx.select().from(notes),
    );
    expect(rows.map((r) => r.body).sort()).toEqual(['a', 'b']);
  });

  it('treats a comma-laden role as one JSON element, not "owner" (delimiter guard)', async () => {
    // `'x,owner'` is a SINGLE role element; the policy's `@>` matches whole
    // elements, so it can never satisfy `["owner"]` by comma-splitting. USER_A
    // therefore stays scoped to their own row.
    const rows = await withUserContext(
      { userId: USER_A, roles: ['x,owner'] },
      (tx) => tx.select().from(notes),
    );
    expect(rows.map((r) => r.body)).toEqual(['a']);
  });

  it('forbids forging another user as creator, but allows writing as self (WITH CHECK)', async () => {
    // WITH CHECK has NO owner branch: even with no/any roles, a write must land
    // a row owned by the acting user. Forging USER_B as creator is rejected.
    // Drizzle wraps the pg error, so the RLS detail lives on `.cause` (the
    // top-level message is a generic "Failed query"); we assert on the
    // authoritative Postgres message there.
    const rejection = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.insert(notes).values({ createdBy: USER_B, body: 'forged' }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);

    // Writing a row owned by self succeeds.
    await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.insert(notes).values({ createdBy: USER_A, body: 'mine' }),
    );

    // Superuser confirms exactly the self-owned row landed (no forged row).
    const { rows } = await rls.admin.query(
      `select created_by, body from notes where body in ('forged', 'mine')`,
    );
    expect(rows).toEqual([{ created_by: USER_A, body: 'mine' }]);
  });
});
