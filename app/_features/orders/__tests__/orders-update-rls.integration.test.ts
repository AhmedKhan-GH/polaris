import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * orders UPDATE RLS — the row-access gate for status transitions. The header has
 * no editable content besides `status`, so every UPDATE is a transition; RLS
 * decides WHO may touch WHICH order, while the legal target status is the
 * action's job (canTransition), not RLS.
 *
 *   - member: may update their OWN order while draft/submitted; frozen once the
 *     office takes it (processing) and on terminal states.
 *   - owner/admin: may update ANY non-terminal order.
 *   - WITH CHECK: a member can never reassign `created_by` (no ownership theft).
 *
 * USING-denied UPDATEs affect zero rows (no error); WITH CHECK violations throw.
 */
const MEMBER_A = '11111111-1111-1111-1111-111111111111';
const MEMBER_B = '22222222-2222-2222-2222-222222222222';

describe('orders UPDATE RLS (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db;
  let orders: typeof import('@/app/_features/orders/schema').orders;
  let eq: typeof import('drizzle-orm').eq;

  let oDraftA = '';
  let oProcA = '';
  let oSubB = '';
  let oDoneA = '';
  let oReassign = '';

  const statusOf = async (id: string) =>
    (await rls.admin.query('select status from orders where id = $1', [id])).rows[0]
      .status as string;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
    ({ orders } = await import('@/app/_features/orders/schema'));
    ({ eq } = await import('drizzle-orm'));

    const mk = async (by: string, status: string) =>
      (
        await rls.admin.query(
          `insert into orders (created_by, status) values ($1, $2) returning id`,
          [by, status],
        )
      ).rows[0].id as string;
    oDraftA = await mk(MEMBER_A, 'draft');
    oProcA = await mk(MEMBER_A, 'processing');
    oSubB = await mk(MEMBER_B, 'submitted');
    oDoneA = await mk(MEMBER_A, 'completed');
    oReassign = await mk(MEMBER_A, 'draft');
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it('lets a member submit their own draft (draft → submitted)', async () => {
    await withUserContext({ userId: MEMBER_A, roles: ['member'] }, (tx) =>
      tx.update(orders).set({ status: 'submitted' }).where(eq(orders.id, oDraftA)),
    );
    expect(await statusOf(oDraftA)).toBe('submitted');
  });

  it('does not let a member touch their order once it is processing (zero rows)', async () => {
    await withUserContext({ userId: MEMBER_A, roles: ['member'] }, (tx) =>
      tx.update(orders).set({ status: 'completed' }).where(eq(orders.id, oProcA)),
    );
    expect(await statusOf(oProcA)).toBe('processing');
  });

  it('does not let a member touch someone else’s order (zero rows)', async () => {
    await withUserContext({ userId: MEMBER_A, roles: ['member'] }, (tx) =>
      tx.update(orders).set({ status: 'draft' }).where(eq(orders.id, oSubB)),
    );
    expect(await statusOf(oSubB)).toBe('submitted');
  });

  it('lets an admin process any non-terminal order (submitted → processing)', async () => {
    await withUserContext({ userId: MEMBER_A, roles: ['admin'] }, (tx) =>
      tx.update(orders).set({ status: 'processing' }).where(eq(orders.id, oSubB)),
    );
    expect(await statusOf(oSubB)).toBe('processing');
  });

  it('freezes terminal orders — even an admin cannot update a completed order', async () => {
    await withUserContext({ userId: MEMBER_A, roles: ['admin'] }, (tx) =>
      tx.update(orders).set({ status: 'processing' }).where(eq(orders.id, oDoneA)),
    );
    expect(await statusOf(oDoneA)).toBe('completed');
  });

  it('forbids a member reassigning created_by (WITH CHECK: no ownership theft)', async () => {
    const rejection = await withUserContext(
      { userId: MEMBER_A, roles: ['member'] },
      (tx) =>
        tx.update(orders).set({ createdBy: MEMBER_B }).where(eq(orders.id, oReassign)),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);
  });
});
