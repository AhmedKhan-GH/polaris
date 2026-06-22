import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * orders role+ownership RLS, against a throwaway testcontainer. Orders are an
 * OWNED resource with a role overlay:
 *
 *   - READ (USING): a row is visible to its creator (`created_by` = the
 *     `app.user_id` GUC) OR to any `owner`/`admin` (read-all).
 *   - INSERT (WITH CHECK): create-as-self — `created_by` must equal the acting
 *     user, for every role (read-all never becomes write-as-anyone on insert).
 *   - `order_number` is assigned from a sequence that starts at 100000;
 *     `status` defaults to `draft`.
 *
 * Prod-shaped: real `withUserContext` → real Drizzle client → real `orders`
 * schema. Module-load order is the contract — boot the container and point
 * `DATABASE_URL` at the `app_user` URI BEFORE the dynamic imports.
 */
const MEMBER_A = '11111111-1111-1111-1111-111111111111';
const MEMBER_B = '22222222-2222-2222-2222-222222222222';

describe('orders role+ownership RLS (testcontainer)', () => {
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

    // Seed as superuser (bypasses RLS): MEMBER_A's order takes the defaults
    // (order_number 100000, status draft); MEMBER_B's is explicitly submitted.
    await rls.admin.query('insert into orders (created_by) values ($1)', [MEMBER_A]);
    await rls.admin.query(
      `insert into orders (created_by, status) values ($1, 'submitted')`,
      [MEMBER_B],
    );
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it('assigns order_number from a sequence starting at 100000, status defaults to draft', async () => {
    const { rows } = await rls.admin.query(
      'select order_number, status from orders where created_by = $1',
      [MEMBER_A],
    );
    expect(rows).toEqual([{ order_number: '100000', status: 'draft' }]);
  });

  it('lets a member read only their own orders (USING: own)', async () => {
    const rows = await withUserContext({ userId: MEMBER_A, roles: ['member'] }, (tx) =>
      tx.select().from(orders),
    );
    expect(rows.map((r) => r.createdBy)).toEqual([MEMBER_A]);
  });

  it('lets an admin read every order (USING: read-all)', async () => {
    const rows = await withUserContext({ userId: MEMBER_A, roles: ['admin'] }, (tx) =>
      tx.select().from(orders),
    );
    expect(rows.map((r) => r.createdBy).sort()).toEqual([MEMBER_A, MEMBER_B]);
  });

  it('lets an owner read every order (USING: read-all)', async () => {
    const rows = await withUserContext({ userId: MEMBER_A, roles: ['owner'] }, (tx) =>
      tx.select().from(orders),
    );
    expect(rows.map((r) => r.createdBy).sort()).toEqual([MEMBER_A, MEMBER_B]);
  });

  it('lets a member create their OWN order (WITH CHECK: created_by = self)', async () => {
    await withUserContext({ userId: MEMBER_A, roles: ['member'] }, (tx) =>
      tx.insert(orders).values({ createdBy: MEMBER_A }),
    );
    const { rows } = await rls.admin.query(
      'select count(*)::int as n from orders where created_by = $1',
      [MEMBER_A],
    );
    expect(rows[0].n).toBe(2); // the seeded one + this insert
  });

  it('rejects a member creating an order owned by someone else (WITH CHECK)', async () => {
    const rejection = await withUserContext(
      { userId: MEMBER_A, roles: ['member'] },
      (tx) => tx.insert(orders).values({ createdBy: MEMBER_B }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);
  });
});
