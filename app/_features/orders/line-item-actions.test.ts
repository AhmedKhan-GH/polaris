// @vitest-environment node
//
// order line-item intake PIPELINE contract (app/_features/orders/actions).
//
// Every foundation seam is hoisted-mocked so the cycles assert PIPELINE ORDER
// and wiring — guard → limiter → validate → context, revalidate only on success.
// All three writes guard `update Order` (editing a line edits the order); the
// ROW-level "is this your order" enforcement is the line-item RLS, proven in the
// integration suite, not here.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORDER_ID = '99999999-9999-4999-8999-999999999999';
const PRODUCT_ID = '88888888-8888-4888-8888-888888888888';
const LINE_ID = '77777777-7777-4777-8777-777777777777';

const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withRateLimit: vi.fn(),
  withUserContext: vi.fn(),
  revalidatePath: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  deleteWhere: vi.fn(),
  calls: [] as string[],
}));

vi.mock('@/lib/permissions/guard', () => ({ withPermission: fake.withPermission }));
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ __limiter: true })),
  withRateLimit: fake.withRateLimit,
}));
vi.mock('@/lib/db/with-user-context', () => ({ withUserContext: fake.withUserContext }));
vi.mock('next/cache', () => ({ revalidatePath: fake.revalidatePath }));

import { addLineItem, getOrderLineItems, removeLineItem, updateLineItem } from './actions';

const LINE_ROWS = [{ id: LINE_ID, orderId: ORDER_ID, productId: PRODUCT_ID, quantity: 3 }];

function txStub() {
  const chain: Record<string, unknown> = {
    insert: vi.fn(() => ({ values: fake.insertValues })),
    update: vi.fn(() => ({ set: fake.updateSet })),
    delete: vi.fn(() => ({ where: fake.deleteWhere })),
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(async () => LINE_ROWS),
  };
  return chain;
}

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  for (const k of ['withPermission', 'withRateLimit', 'withUserContext', 'revalidatePath', 'insertValues', 'updateSet', 'updateWhere', 'deleteWhere'] as const) {
    fake[k].mockReset();
  }
  fake.calls.length = 0;
  fake.withPermission.mockImplementation(async (_a, _s, fn) => {
    fake.calls.push('guard');
    return fn({ userId: 'u', roles: [] });
  });
  fake.withRateLimit.mockImplementation(async (_l, _k, fn) => {
    fake.calls.push('limiter');
    return fn();
  });
  fake.withUserContext.mockImplementation(async (_c, fn) => {
    fake.calls.push('context');
    return fn(txStub());
  });
  fake.insertValues.mockResolvedValue(undefined);
  fake.updateSet.mockReturnValue({ where: fake.updateWhere });
  fake.updateWhere.mockResolvedValue(undefined);
  fake.deleteWhere.mockResolvedValue(undefined);
});

describe('app/_features/orders addLineItem', () => {
  it('guards update/Order, inserts { orderId, productId, quantity }, revalidates the order', async () => {
    await addLineItem(fd({ orderId: ORDER_ID, productId: PRODUCT_ID, quantity: '3' }));
    expect(fake.withPermission).toHaveBeenCalledWith('update', 'Order', expect.any(Function));
    expect(fake.insertValues).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      quantity: 3,
    });
    expect(fake.revalidatePath).toHaveBeenCalledWith(`/orders/${ORDER_ID}`);
    expect(fake.calls).toEqual(['guard', 'limiter', 'context']);
  });

  it('rejects a non-positive quantity without inserting', async () => {
    await expect(
      addLineItem(fd({ orderId: ORDER_ID, productId: PRODUCT_ID, quantity: '0' })),
    ).rejects.toThrow(/quantity/i);
    expect(fake.insertValues).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid product id without inserting', async () => {
    await expect(
      addLineItem(fd({ orderId: ORDER_ID, productId: 'nope', quantity: '1' })),
    ).rejects.toThrow();
    expect(fake.insertValues).not.toHaveBeenCalled();
  });
});

describe('app/_features/orders updateLineItem', () => {
  it('guards update/Order, sets the new quantity by line id, revalidates the order', async () => {
    await updateLineItem(fd({ id: LINE_ID, orderId: ORDER_ID, quantity: '7' }));
    expect(fake.withPermission).toHaveBeenCalledWith('update', 'Order', expect.any(Function));
    expect(fake.updateSet).toHaveBeenCalledWith({ quantity: 7 });
    expect(fake.updateWhere).toHaveBeenCalled();
    expect(fake.revalidatePath).toHaveBeenCalledWith(`/orders/${ORDER_ID}`);
  });
});

describe('app/_features/orders getOrderLineItems', () => {
  it('guards read/Order and resolves the order’s lines (RLS-scoped)', async () => {
    const rows = await getOrderLineItems(ORDER_ID);
    expect(fake.withPermission).toHaveBeenCalledWith('read', 'Order', expect.any(Function));
    expect(rows).toEqual(LINE_ROWS);
    expect(fake.calls).toEqual(['guard', 'context']);
  });
});

describe('app/_features/orders removeLineItem', () => {
  it('guards update/Order, deletes by line id, revalidates the order', async () => {
    await removeLineItem(fd({ id: LINE_ID, orderId: ORDER_ID }));
    expect(fake.withPermission).toHaveBeenCalledWith('update', 'Order', expect.any(Function));
    expect(fake.deleteWhere).toHaveBeenCalled();
    expect(fake.revalidatePath).toHaveBeenCalledWith(`/orders/${ORDER_ID}`);
  });
});
