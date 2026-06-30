import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * `order_events` append-only + owner-read RLS, against a throwaway testcontainer.
 * The event log is an audit trail (ADR-0007):
 *
 *   - READ (USING): OWNER-only — the log is sensitive history, gated like
 *     `sign_in_log`. A non-owner sees no rows; the policy fails CLOSED.
 *   - INSERT (WITH CHECK true): any signed-in caller's authorized action may
 *     APPEND an event — the action itself is the gate (it already proved the
 *     caller may mutate the order), so the row write must not be role-gated.
 *   - UPDATE / DELETE: forbidden for EVERY role, app_user included — append-only,
 *     enforced by withholding the grant (mirrors `sign_in_log`).
 *
 * Module-load order is the contract: boot the container and point DATABASE_URL at
 * the app_user URI BEFORE the dynamic imports.
 */
const OWNER = '11111111-1111-1111-1111-111111111111';
const MEMBER = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';

describe('order_events append-only + owner-read RLS (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db;
  let orderEvents: typeof import('@/app/_features/orders/schema').orderEvents;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
    ({ orderEvents } = await import('@/app/_features/orders/schema'));

    // Seed (superuser, bypasses RLS): an order + its creation event (null -> draft).
    await rls.admin.query('insert into orders (id, created_by) values ($1, $2)', [ORDER_ID, OWNER]);
    await rls.admin.query(
      `insert into order_events (order_id, from_status, to_status, actor_id)
       values ($1, null, 'draft', $2)`,
      [ORDER_ID, OWNER],
    );
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it('lets an OWNER read the event log (USING: owner-only)', async () => {
    const rows = await withUserContext({ userId: OWNER, roles: ['owner'] }, (tx) =>
      tx.select().from(orderEvents),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].toStatus).toBe('draft');
    expect(rows[0].fromStatus).toBeNull(); // creation
  });

  it('hides every row from a non-owner (USING fails closed)', async () => {
    const rows = await withUserContext({ userId: MEMBER, roles: ['member'] }, (tx) =>
      tx.select().from(orderEvents),
    );
    expect(rows).toHaveLength(0);
  });

  it("lets a member's authorized action APPEND an event (INSERT open)", async () => {
    await withUserContext({ userId: MEMBER, roles: ['member'] }, (tx) =>
      tx.insert(orderEvents).values({
        orderId: ORDER_ID,
        fromStatus: 'draft',
        toStatus: 'submitted',
        actorId: MEMBER,
      }),
    );
    const { rows } = await rls.admin.query('select count(*)::int as n from order_events');
    expect(rows[0].n).toBe(2); // seeded creation + this append
  });

  it('forbids UPDATE — the log is append-only (no UPDATE grant)', async () => {
    const rejection = await withUserContext({ userId: OWNER, roles: ['owner'] }, (tx) =>
      tx.update(orderEvents).set({ toStatus: 'tampered' }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/permission denied/i);
  });

  it('forbids DELETE — the log is append-only (no DELETE grant)', async () => {
    const rejection = await withUserContext({ userId: OWNER, roles: ['owner'] }, (tx) =>
      tx.delete(orderEvents),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/permission denied/i);
  });
});
