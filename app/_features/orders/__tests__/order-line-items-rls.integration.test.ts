import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * order_line_items RLS, against a throwaway testcontainer. A line item has NO
 * owner of its own — its visibility and writability DERIVE FROM ITS PARENT
 * ORDER. The policy joins back to `orders`: you may read a line iff you can read
 * its order (own, or owner read-all), and you may write a line iff the parent
 * order is YOUR OWN (write-as-self — an owner reading all orders still cannot
 * edit another rep's order's lines, mirroring the order WITH CHECK).
 *
 * Prod-shaped: real `withUserContext` → real Drizzle client → real schemas.
 * Seeding runs on the `admin` (superuser) pool, which bypasses RLS.
 */
const REP_A = '11111111-1111-1111-1111-111111111111';
const REP_B = '22222222-2222-2222-2222-222222222222';

describe('order_line_items derived RLS (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db;
  let orderLineItems: typeof import('@/app/_features/orders/schema').orderLineItems;
  let productId: string;
  let productId2: string;
  let productId3: string;
  let orderAId: string;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
    ({ orderLineItems } = await import('@/app/_features/orders/schema'));

    // Seed as superuser: a product, one order per rep, one line on REP_A's order.
    const p = await rls.admin.query(
      `insert into products (name, sku, price_cents) values ('P', 'SKU-1', 100), ('P2', 'SKU-2', 200), ('P3', 'SKU-3', 300) returning id`,
    );
    productId = p.rows[0].id;
    productId2 = p.rows[1].id;
    productId3 = p.rows[2].id;
    const a = await rls.admin.query(
      `insert into orders (created_by) values ($1) returning id`,
      [REP_A],
    );
    orderAId = a.rows[0].id;
    await rls.admin.query(`insert into orders (created_by) values ($1)`, [REP_B]);
    await rls.admin.query(
      `insert into order_line_items (order_id, product_id, quantity) values ($1, $2, 2)`,
      [orderAId, productId],
    );
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it('lets REP_A read the line on their own order', async () => {
    const rows = await withUserContext({ userId: REP_A, roles: [] }, (tx) =>
      tx.select().from(orderLineItems),
    );
    expect(rows.map((r) => r.orderId)).toEqual([orderAId]);
  });

  it('hides REP_A’s line from REP_B (parent order not visible)', async () => {
    const rows = await withUserContext({ userId: REP_B, roles: [] }, (tx) =>
      tx.select().from(orderLineItems),
    );
    expect(rows).toEqual([]);
  });

  it('lets an owner read the line (parent order read-all)', async () => {
    const rows = await withUserContext({ userId: REP_B, roles: ['owner'] }, (tx) =>
      tx.select().from(orderLineItems),
    );
    expect(rows.map((r) => r.orderId)).toEqual([orderAId]);
  });

  it('lets REP_A add a line to their own order', async () => {
    await withUserContext({ userId: REP_A, roles: [] }, (tx) =>
      tx.insert(orderLineItems).values({ orderId: orderAId, productId: productId2, quantity: 5 }),
    );
    const { rows } = await rls.admin.query(
      `select count(*)::int as n from order_line_items where order_id = $1`,
      [orderAId],
    );
    expect(rows[0].n).toBe(2);
  });

  it('forbids REP_B from adding a line to REP_A’s order (WITH CHECK: not own)', async () => {
    const rejection = await withUserContext({ userId: REP_B, roles: [] }, (tx) =>
      tx.insert(orderLineItems).values({ orderId: orderAId, productId: productId3, quantity: 1 }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);
  });

  it('forbids an OWNER from adding a line to REP_A’s order (read-all ≠ write-all)', async () => {
    const rejection = await withUserContext({ userId: REP_B, roles: ['owner'] }, (tx) =>
      tx.insert(orderLineItems).values({ orderId: orderAId, productId: productId3, quantity: 1 }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);
  });
});
