// @vitest-environment node
//
// orders server actions PIPELINE contract (app/_features/orders/actions).
//
// Foundation seams are hoisted-mocked so the cycles assert wiring + the two
// novel behaviours — addLine captures a PRICE SNAPSHOT from the products
// dev-API, and transitionOrder gates the move through the real state machine
// (canTransition) — WITHOUT a real session, ability, limiter, Postgres, or
// cache. Real CASL + RLS are proven in the integration suite.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORDER = '11111111-1111-4111-8111-111111111111';
const PRODUCT = '22222222-2222-4222-8222-222222222222';
const LINE = '33333333-3333-4333-8333-333333333333';

const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withRateLimit: vi.fn(),
  withUserContext: vi.fn(),
  revalidatePath: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  deleteWhere: vi.fn(),
  selectRows: [] as unknown[],
  roles: ['member'] as string[],
  calls: [] as string[],
}));

vi.mock('@/lib/permissions/guard', () => ({ withPermission: fake.withPermission }));
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ __limiter: true })),
  withRateLimit: fake.withRateLimit,
}));
vi.mock('@/lib/db/with-user-context', () => ({ withUserContext: fake.withUserContext }));
vi.mock('next/cache', () => ({ revalidatePath: fake.revalidatePath }));

import {
  addLine,
  createOrder,
  getOrders,
  removeLine,
  transitionOrder,
  updateLine,
} from './actions';

function txStub() {
  const chain = {
    insert: vi.fn(() => ({
      values: vi.fn((v: unknown) => {
        fake.insertValues(v);
        return {
          returning: async () => [{ id: 'order-new' }],
          then: (r: (x: undefined) => void) => r(undefined),
        };
      }),
    })),
    update: vi.fn(() => ({ set: fake.updateSet })),
    delete: vi.fn(() => ({ where: fake.deleteWhere })),
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(async () => fake.selectRows),
    orderBy: vi.fn(async () => fake.selectRows),
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
  fake.selectRows = [];
  fake.roles = ['member'];

  fake.withPermission.mockImplementation(async (_a: string, _s: string, fn: (ctx: { userId: string; roles: string[] }) => unknown) => {
    fake.calls.push('guard');
    return fn({ userId: ORDER, roles: fake.roles });
  });
  fake.withRateLimit.mockImplementation(async (_l: unknown, _k: string, fn: () => unknown) => {
    fake.calls.push('limiter');
    return fn();
  });
  fake.withUserContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => unknown) => {
    fake.calls.push('context');
    return fn(txStub());
  });
  fake.updateSet.mockReturnValue({ where: fake.updateWhere });
  fake.updateWhere.mockResolvedValue(undefined);
  fake.deleteWhere.mockResolvedValue(undefined);
});

describe('createOrder', () => {
  it('guards create/Order, inserts created_by=self, returns the new id, revalidates /orders', async () => {
    const id = await createOrder();
    expect(fake.withPermission).toHaveBeenCalledWith('create', 'Order', expect.any(Function));
    expect(fake.insertValues).toHaveBeenCalledWith({ createdBy: ORDER });
    expect(id).toBe('order-new');
    expect(fake.revalidatePath).toHaveBeenCalledWith('/orders');
    expect(fake.calls).toEqual(['guard', 'limiter', 'context']);
  });
});

describe('getOrders', () => {
  it('guards read/Order and resolves rows', async () => {
    fake.selectRows = [{ id: 'o1' }];
    const rows = await getOrders();
    expect(fake.withPermission).toHaveBeenCalledWith('read', 'Order', expect.any(Function));
    expect(rows).toEqual([{ id: 'o1' }]);
  });
});

describe('addLine (append + price snapshot)', () => {
  it('guards update/Order and appends a new line with the next line_number', async () => {
    fake.selectRows = [{ max: 2 }]; // existing highest line_number for the order
    await addLine({ orderId: ORDER, productId: PRODUCT, quantity: 3, unitPriceCents: 250 });
    expect(fake.withPermission).toHaveBeenCalledWith('update', 'Order', expect.any(Function));
    // A NEW line (no merge), with the snapshot price and the next line_number.
    expect(fake.insertValues).toHaveBeenCalledWith({
      orderId: ORDER,
      productId: PRODUCT,
      quantity: 3,
      unitPriceCents: 250,
      lineNumber: 3,
    });
    expect(fake.revalidatePath).toHaveBeenCalledWith(`/orders/${ORDER}`);
  });

  it('rejects a negative price without inserting', async () => {
    await expect(
      addLine({ orderId: ORDER, productId: PRODUCT, quantity: 1, unitPriceCents: -5 }),
    ).rejects.toThrow(/price/i);
    expect(fake.insertValues).not.toHaveBeenCalled();
  });
});

describe('updateLine / removeLine', () => {
  it('updateLine guards update/Order, sets quantity by id', async () => {
    await updateLine(fd({ id: LINE, orderId: ORDER, quantity: '5' }));
    expect(fake.updateSet).toHaveBeenCalledWith({ quantity: 5 });
    expect(fake.updateWhere).toHaveBeenCalled();
  });

  it('removeLine guards update/Order, deletes by id', async () => {
    await removeLine(fd({ id: LINE, orderId: ORDER }));
    expect(fake.deleteWhere).toHaveBeenCalled();
    expect(fake.revalidatePath).toHaveBeenCalledWith(`/orders/${ORDER}`);
  });
});

describe('transitionOrder (state machine gate)', () => {
  it('a member can submit their own draft (draft → submitted)', async () => {
    fake.roles = ['member'];
    fake.selectRows = [{ status: 'draft' }];
    await transitionOrder(fd({ orderId: ORDER, to: 'submitted' }));
    expect(fake.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'submitted' }),
    );
  });

  it('rejects an illegal transition (member cannot process) and never updates', async () => {
    fake.roles = ['member'];
    fake.selectRows = [{ status: 'submitted' }];
    await expect(
      transitionOrder(fd({ orderId: ORDER, to: 'processing' })),
    ).rejects.toThrow(/transition/i);
    expect(fake.updateSet).not.toHaveBeenCalled();
  });

  it('an admin can process a submitted order', async () => {
    fake.roles = ['admin'];
    fake.selectRows = [{ status: 'submitted' }];
    await transitionOrder(fd({ orderId: ORDER, to: 'processing' }));
    expect(fake.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing' }),
    );
  });
});
