import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * orders ownership-RLS isolation, against a throwaway testcontainer. An order is
 * an OWNED resource (instance-level): a rep sees and writes only their own
 * orders, an owner reads all. The policy targets `app_user` and the `app.user_*`
 * GUCs, which the vanilla container has after migrations.
 *
 * Prod-shaped: real `withUserContext` → real Drizzle client → real `orders`
 * schema. Module-load order is the contract — `lib/db/client` binds
 * `DATABASE_URL` at import, so we boot the container and point `DATABASE_URL` at
 * the `app_user` URI BEFORE the dynamic imports. Seeding runs on the `admin`
 * (superuser) pool, which bypasses RLS.
 */
const REP_A = '11111111-1111-1111-1111-111111111111';
const REP_B = '22222222-2222-2222-2222-222222222222';

describe('orders ownership RLS (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db;
  let orders: typeof import('@/app/_features/orders/schema').orders;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
    ({ orders } = await import('@/app/_features/orders/schema'));

    // Seed as superuser (bypasses RLS): one order per rep.
    await rls.admin.query(
      'insert into orders (created_by) values ($1), ($2)',
      [REP_A, REP_B],
    );
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it('shows REP_A only their own order (USING: own rows)', async () => {
    const rows = await withUserContext({ userId: REP_A, roles: [] }, (tx) =>
      tx.select().from(orders),
    );
    expect(rows.map((r) => r.createdBy)).toEqual([REP_A]);
  });

  it('shows an owner ALL orders (USING: owner-role read-all branch)', async () => {
    const rows = await withUserContext({ userId: REP_B, roles: ['owner'] }, (tx) =>
      tx.select().from(orders),
    );
    expect(rows.map((r) => r.createdBy).sort()).toEqual([REP_A, REP_B]);
  });

  it('forbids forging another rep as creator, but allows writing as self (WITH CHECK)', async () => {
    const rejection = await withUserContext({ userId: REP_A, roles: [] }, (tx) =>
      tx.insert(orders).values({ createdBy: REP_B }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);

    await withUserContext({ userId: REP_A, roles: [] }, (tx) =>
      tx.insert(orders).values({ createdBy: REP_A }),
    );
    const { rows } = await rls.admin.query(
      `select count(*)::int as n from orders where created_by = $1`,
      [REP_A],
    );
    expect(rows[0].n).toBe(2); // the seeded one + the self-write
  });
});
