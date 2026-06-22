import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * order_lines parent-derived RLS, against a throwaway testcontainer. A line is
 * NOT independently owned — access derives from its parent order:
 *
 *   - READ (USING): visible iff the parent order is visible (own OR owner/admin).
 *   - WRITE (INSERT/UPDATE/DELETE): allowed iff the caller may WRITE the parent —
 *     a `member` only on their OWN `draft` order; `owner`/`admin` on any
 *     non-terminal order. Terminal parents (`completed`/`cancelled`) are frozen
 *     for everyone.
 *
 * Plus structural invariants: one row per (order, product), positive quantity,
 * and a stored `unit_price_cents` snapshot. Constraint checks run on the `admin`
 * (superuser) pool, which bypasses RLS but not constraints.
 */
const MEMBER_A = '11111111-1111-1111-1111-111111111111';
const MEMBER_B = '22222222-2222-2222-2222-222222222222';

describe('order_lines parent-derived RLS (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db;
  let orderLines: typeof import('@/app/_features/orders/schema').orderLines;

  let orderA = ''; // MEMBER_A, draft
  let orderB = ''; // MEMBER_B, submitted
  let orderC = ''; // MEMBER_A, processing
  let orderD = ''; // MEMBER_A, completed (terminal)
  let p1 = '';
  let p2 = '';

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
    ({ orderLines } = await import('@/app/_features/orders/schema'));

    const prods = await rls.admin.query(
      `insert into products (name, sku, price_cents)
         values ('P1', 'SKU-1', 100), ('P2', 'SKU-2', 200) returning id, sku`,
    );
    p1 = prods.rows.find((r) => r.sku === 'SKU-1').id;
    p2 = prods.rows.find((r) => r.sku === 'SKU-2').id;

    const mkOrder = async (by: string, status: string) =>
      (
        await rls.admin.query(
          `insert into orders (created_by, status) values ($1, $2) returning id`,
          [by, status],
        )
      ).rows[0].id as string;
    orderA = await mkOrder(MEMBER_A, 'draft');
    orderB = await mkOrder(MEMBER_B, 'submitted');
    orderC = await mkOrder(MEMBER_A, 'processing');
    orderD = await mkOrder(MEMBER_A, 'completed');

    // One line on A (MEMBER_A's) and one on B (MEMBER_B's) for read tests.
    await rls.admin.query(
      `insert into order_lines (order_id, product_id, quantity, unit_price_cents)
         values ($1, $2, 1, 100), ($3, $4, 2, 200)`,
      [orderA, p1, orderB, p1],
    );
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it('lets a member read lines only for their own orders (parent-derived)', async () => {
    const rows = await withUserContext({ userId: MEMBER_A, roles: ['member'] }, (tx) =>
      tx.select().from(orderLines),
    );
    expect(rows.map((r) => r.orderId)).toEqual([orderA]);
  });

  it('lets an admin read lines for every order', async () => {
    const rows = await withUserContext({ userId: MEMBER_A, roles: ['admin'] }, (tx) =>
      tx.select().from(orderLines),
    );
    expect(rows.map((r) => r.orderId).sort()).toEqual([orderA, orderB].sort());
  });

  it('lets a member add a line to their OWN DRAFT order, storing a price snapshot', async () => {
    await withUserContext({ userId: MEMBER_A, roles: ['member'] }, (tx) =>
      tx
        .insert(orderLines)
        .values({ orderId: orderA, productId: p2, quantity: 3, unitPriceCents: 200 }),
    );
    const { rows } = await rls.admin.query(
      `select unit_price_cents from order_lines where order_id = $1 and product_id = $2`,
      [orderA, p2],
    );
    expect(rows).toEqual([{ unit_price_cents: 200 }]);
  });

  it('forbids a member adding a line to their own NON-draft (processing) order', async () => {
    const rejection = await withUserContext(
      { userId: MEMBER_A, roles: ['member'] },
      (tx) =>
        tx
          .insert(orderLines)
          .values({ orderId: orderC, productId: p1, quantity: 1, unitPriceCents: 100 }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);
  });

  it('lets an admin add a line to any non-terminal order (a member’s submitted order)', async () => {
    await withUserContext({ userId: MEMBER_A, roles: ['admin'] }, (tx) =>
      tx
        .insert(orderLines)
        .values({ orderId: orderB, productId: p2, quantity: 1, unitPriceCents: 200 }),
    );
    const { rows } = await rls.admin.query(
      `select count(*)::int as n from order_lines where order_id = $1`,
      [orderB],
    );
    expect(rows[0].n).toBe(2);
  });

  it('freezes a terminal (completed) order — even an admin cannot add lines', async () => {
    const rejection = await withUserContext(
      { userId: MEMBER_A, roles: ['admin'] },
      (tx) =>
        tx
          .insert(orderLines)
          .values({ orderId: orderD, productId: p1, quantity: 1, unitPriceCents: 100 }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);
  });

  it('enforces one row per product per order (unique constraint)', async () => {
    const dup = await rls.admin
      .query(
        `insert into order_lines (order_id, product_id, quantity, unit_price_cents)
           values ($1, $2, 9, 100)`,
        [orderA, p1], // (orderA, p1) already seeded
      )
      .then(
        () => null,
        (err: unknown) => err,
      );
    expect(dup).not.toBeNull();
  });

  it('rejects a non-positive quantity (check constraint)', async () => {
    const bad = await rls.admin
      .query(
        `insert into order_lines (order_id, product_id, quantity, unit_price_cents)
           values ($1, $2, 0, 100)`,
        [orderC, p2],
      )
      .then(
        () => null,
        (err: unknown) => err,
      );
    expect(bad).not.toBeNull();
  });

  it('merges quantity when the same product is added again (upsert, no unique crash)', async () => {
    const { sql } = await import('drizzle-orm');
    const oMerge = (
      await rls.admin.query(
        `insert into orders (created_by, status) values ($1, 'draft') returning id`,
        [MEMBER_A],
      )
    ).rows[0].id as string;

    // The exact upsert addLine performs: re-adding a product sums quantity and
    // keeps the original price snapshot, rather than tripping the unique index.
    const add = (qty: number) =>
      withUserContext({ userId: MEMBER_A, roles: ['member'] }, (tx) =>
        tx
          .insert(orderLines)
          .values({ orderId: oMerge, productId: p2, quantity: qty, unitPriceCents: 200 })
          .onConflictDoUpdate({
            target: [orderLines.orderId, orderLines.productId],
            set: { quantity: sql`${orderLines.quantity} + ${qty}` },
          }),
      );
    await add(2);
    await add(3);

    const { rows } = await rls.admin.query(
      'select quantity, unit_price_cents from order_lines where order_id = $1 and product_id = $2',
      [oMerge, p2],
    );
    expect(rows).toEqual([{ quantity: 5, unit_price_cents: 200 }]);
  });
});
