import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * products role-RLS, against a throwaway testcontainer. Products is a FLAT
 * catalog: the policy is role-based and reads `app.user_roles` only (no
 * per-row, identity-scoped ownership). Two invariants:
 *
 *   - READ is unconditional — every signed-in caller (any/no roles) sees the
 *     whole catalog (the line-item picker needs it).
 *   - WRITE is owner-only — an `owner` may INSERT/UPDATE/DELETE; a non-owner's
 *     INSERT trips the WITH CHECK and throws, while their UPDATE/DELETE match
 *     ZERO rows under the USING clause (no error, no effect).
 *
 * Prod-shaped: real `withUserContext` → real Drizzle client → real `products`
 * schema. Module-load order is the contract — `lib/db/client` binds
 * `DATABASE_URL` at import, so we boot the container and point `DATABASE_URL` at
 * the `app_user` URI BEFORE the dynamic imports. Seeding runs on the `admin`
 * (superuser) pool, which bypasses RLS.
 */
const MEMBER = '11111111-1111-1111-1111-111111111111';

describe('products role RLS (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db;
  let products: typeof import('@/app/_features/products/schema').products;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    // Dynamic import AFTER env is set: the client binds to DATABASE_URL on load.
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
    ({ products } = await import('@/app/_features/products/schema'));

    // Seed as superuser (bypasses RLS): two catalog rows.
    await rls.admin.query(
      'insert into products (name, sku, price_cents, created_by) values ($1, $2, $3, $7), ($4, $5, $6, $7)',
      ['Widget', 'SKU-1', 100, 'Gadget', 'SKU-2', 250, MEMBER],
    );
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it('lets a non-owner read the whole catalog (USING: read-all)', async () => {
    const rows = await withUserContext({ userId: MEMBER, roles: ['member'] }, (tx) =>
      tx.select().from(products),
    );
    expect(rows.map((r) => r.sku).sort()).toEqual(['SKU-1', 'SKU-2']);
  });

  it('lets an owner INSERT a product (WITH CHECK: owner)', async () => {
    await withUserContext({ userId: MEMBER, roles: ['owner'] }, (tx) =>
      tx.insert(products).values({ name: 'Sprocket', sku: 'SKU-3', priceCents: 500, createdBy: MEMBER }),
    );
    const { rows } = await rls.admin.query(
      `select name from products where sku = 'SKU-3'`,
    );
    expect(rows).toEqual([{ name: 'Sprocket' }]);
  });

  it('rejects a non-owner INSERT (WITH CHECK has no member branch)', async () => {
    const rejection = await withUserContext(
      { userId: MEMBER, roles: ['member'] },
      (tx) =>
        tx.insert(products).values({ name: 'Sneak', sku: 'SKU-X', priceCents: 1, createdBy: MEMBER }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);

    const { rows } = await rls.admin.query(
      `select count(*)::int as n from products where sku = 'SKU-X'`,
    );
    expect(rows[0].n).toBe(0);
  });

  it('lets an owner UPDATE (rename / retire) but a non-owner UPDATE matches zero rows', async () => {
    const { eq } = await import('drizzle-orm');

    // Owner retires SKU-1.
    await withUserContext({ userId: MEMBER, roles: ['owner'] }, (tx) =>
      tx.update(products).set({ retired: true }).where(eq(products.sku, 'SKU-1')),
    );
    // Non-owner tries to un-retire it: USING denies the row, zero rows change.
    await withUserContext({ userId: MEMBER, roles: ['member'] }, (tx) =>
      tx.update(products).set({ retired: false }).where(eq(products.sku, 'SKU-1')),
    );

    const { rows } = await rls.admin.query(
      `select retired from products where sku = 'SKU-1'`,
    );
    expect(rows).toEqual([{ retired: true }]);
  });

  it('lets an owner DELETE but a non-owner DELETE matches zero rows', async () => {
    const { eq } = await import('drizzle-orm');

    // Non-owner delete: USING denies, SKU-2 survives.
    await withUserContext({ userId: MEMBER, roles: ['member'] }, (tx) =>
      tx.delete(products).where(eq(products.sku, 'SKU-2')),
    );
    let count = await rls.admin.query(
      `select count(*)::int as n from products where sku = 'SKU-2'`,
    );
    expect(count.rows[0].n).toBe(1);

    // Owner delete: removed.
    await withUserContext({ userId: MEMBER, roles: ['owner'] }, (tx) =>
      tx.delete(products).where(eq(products.sku, 'SKU-2')),
    );
    count = await rls.admin.query(
      `select count(*)::int as n from products where sku = 'SKU-2'`,
    );
    expect(count.rows[0].n).toBe(0);
  });

  it('treats a comma-laden role as one JSON element, not "owner" (delimiter guard)', async () => {
    // `'x,owner'` is a SINGLE element; the policy's `@>` matches whole elements,
    // so it can never satisfy `["owner"]` by comma-splitting. The INSERT is
    // therefore treated as a non-owner write and rejected.
    const rejection = await withUserContext(
      { userId: MEMBER, roles: ['x,owner'] },
      (tx) =>
        tx.insert(products).values({ name: 'Forge', sku: 'SKU-Y', priceCents: 1, createdBy: MEMBER }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);
  });
});
