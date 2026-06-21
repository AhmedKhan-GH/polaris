// @vitest-environment node
//
// orders server actions PIPELINE contract (app/_features/orders/actions).
//
// Runs in the `node` environment: server-side action plumbing. Every foundation
// seam is hoisted-mocked so the cycles assert PIPELINE ORDER and wiring — guard →
// limiter → validate → context, then revalidate only on success — WITHOUT a real
// session, ability, limiter store, Postgres, or Next cache. The live behaviours
// (real CASL + RLS + limiter) are proven in the integration suite.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '99999999-9999-4999-8999-999999999999';

const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withRateLimit: vi.fn(),
  withUserContext: vi.fn(),
  revalidatePath: vi.fn(),
  insertValues: vi.fn(),
  returning: vi.fn(),
  whereRows: vi.fn(),
  rows: [
    { id: 'o1', createdBy: '11111111-1111-1111-1111-111111111111', createdAt: new Date('2026-01-01T00:00:00Z') },
  ] as unknown[],
  calls: [] as string[],
}));

vi.mock('@/lib/permissions/guard', () => ({ withPermission: fake.withPermission }));
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ __limiter: true })),
  withRateLimit: fake.withRateLimit,
}));
vi.mock('@/lib/db/with-user-context', () => ({ withUserContext: fake.withUserContext }));
vi.mock('next/cache', () => ({ revalidatePath: fake.revalidatePath }));

import { createOrder, getOrder, getOrders } from './actions';

/**
 * A drizzle-shaped chainable tx stub:
 *   insert().values().returning() → records the insert, resolves to [{ id }]
 *   select().from().orderBy()     → resolves to `rows` (list)
 *   select().from().where()       → resolves to `whereRows()` (single lookup)
 */
function txStub(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    insert: vi.fn(() => ({ values: fake.insertValues })),
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    orderBy: vi.fn(async () => rows),
    where: fake.whereRows,
  };
  return chain;
}

beforeEach(() => {
  for (const k of ['withPermission', 'withRateLimit', 'withUserContext', 'revalidatePath', 'insertValues', 'returning', 'whereRows'] as const) {
    fake[k].mockReset();
  }
  fake.calls.length = 0;

  fake.withPermission.mockImplementation(async (_action, _subject, fn) => {
    fake.calls.push('guard');
    return fn({ userId: ME, roles: [] });
  });
  fake.withRateLimit.mockImplementation(async (_limiter, _key, fn) => {
    fake.calls.push('limiter');
    return fn();
  });
  fake.withUserContext.mockImplementation(async (_ctx, fn) => {
    fake.calls.push('context');
    return fn(txStub(fake.rows));
  });
  fake.insertValues.mockReturnValue({ returning: fake.returning });
  fake.returning.mockResolvedValue([{ id: ORDER_ID }]);
  fake.whereRows.mockResolvedValue(fake.rows);
});

describe('app/_features/orders createOrder', () => {
  it('guards create/Order, inserts a draft owned by the caller, returns its id, revalidates', async () => {
    const id = await createOrder();

    expect(fake.withPermission).toHaveBeenCalledWith('create', 'Order', expect.any(Function));
    expect(fake.insertValues).toHaveBeenCalledWith({ createdBy: ME });
    expect(id).toBe(ORDER_ID);
    expect(fake.revalidatePath).toHaveBeenCalledWith('/orders');
    expect(fake.calls).toEqual(['guard', 'limiter', 'context']);
  });
});

describe('app/_features/orders getOrders', () => {
  it('guards read/Order and resolves rows from the tx chain', async () => {
    const result = await getOrders();
    expect(fake.withPermission).toHaveBeenCalledWith('read', 'Order', expect.any(Function));
    expect(result).toEqual(fake.rows);
    expect(fake.calls).toEqual(['guard', 'context']);
  });
});

describe('app/_features/orders getOrder', () => {
  it('guards read/Order, validates the id, and returns the single visible row', async () => {
    const result = await getOrder(ORDER_ID);
    expect(fake.withPermission).toHaveBeenCalledWith('read', 'Order', expect.any(Function));
    expect(result).toEqual(fake.rows[0]);
  });

  it('returns undefined when no row is visible (RLS-scoped)', async () => {
    fake.whereRows.mockResolvedValue([]);
    expect(await getOrder(ORDER_ID)).toBeUndefined();
  });

  it('rejects a non-uuid id without touching the database', async () => {
    await expect(getOrder('not-a-uuid')).rejects.toThrow();
    expect(fake.whereRows).not.toHaveBeenCalled();
  });
});
