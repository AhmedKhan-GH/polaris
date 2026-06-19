// @vitest-environment node
//
// products server actions PIPELINE contract (app/_features/products/actions).
//
// Runs in the `node` environment: server-side action plumbing. Every foundation
// seam is hoisted-mocked so the cycles assert the PIPELINE ORDER and wiring —
// guard → limiter → validate → context, then revalidate only on success —
// WITHOUT a real session, ability, limiter store, Postgres, or Next cache. The
// live behaviours (real CASL + RLS + limiter) are proven in the integration
// suite.
//
// Catalog writes are guarded by the CRUD verb the owner's `manage` covers:
// create→create, update→update, retire(soft delete)→delete. Reads are `read`.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ID = '11111111-1111-4111-8111-111111111111';

const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withRateLimit: vi.fn(),
  withUserContext: vi.fn(),
  revalidatePath: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  rows: [
    { id: 'p1', name: 'Widget', sku: 'SKU-1', priceCents: 100, retired: false, createdAt: new Date('2026-01-01T00:00:00Z') },
  ] as unknown[],
  /** Records the order in which the pipeline stages were entered. */
  calls: [] as string[],
}));

vi.mock('@/lib/permissions/guard', () => ({
  withPermission: fake.withPermission,
}));
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ __limiter: true })),
  withRateLimit: fake.withRateLimit,
}));
vi.mock('@/lib/db/with-user-context', () => ({
  withUserContext: fake.withUserContext,
}));
vi.mock('next/cache', () => ({
  revalidatePath: fake.revalidatePath,
}));

import { createProduct, getProducts, retireProduct, updateProduct } from './actions';

/**
 * A drizzle-shaped chainable tx stub. `insert().values()` records the inserted
 * values; `update().set().where()` records the set payload; `select().from()
 * .orderBy()` resolves to `rows`.
 */
function txStub(rows: unknown[]) {
  const chain = {
    insert: vi.fn(() => ({ values: fake.insertValues })),
    update: vi.fn(() => ({ set: fake.updateSet })),
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    orderBy: vi.fn(async () => rows),
  };
  return chain;
}

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  fake.withPermission.mockReset();
  fake.withRateLimit.mockReset();
  fake.withUserContext.mockReset();
  fake.revalidatePath.mockReset();
  fake.insertValues.mockReset();
  fake.updateSet.mockReset();
  fake.updateWhere.mockReset();
  fake.calls.length = 0;

  fake.withPermission.mockImplementation(async (_action, _subject, fn) => {
    fake.calls.push('guard');
    return fn({ userId: ID, roles: ['owner'] });
  });
  fake.withRateLimit.mockImplementation(async (_limiter, _key, fn) => {
    fake.calls.push('limiter');
    return fn();
  });
  fake.withUserContext.mockImplementation(async (_ctx, fn) => {
    fake.calls.push('context');
    return fn(txStub(fake.rows));
  });
  fake.insertValues.mockResolvedValue(undefined);
  fake.updateSet.mockReturnValue({ where: fake.updateWhere });
  fake.updateWhere.mockResolvedValue(undefined);
});

describe('app/_features/products createProduct', () => {
  it('guards create/Product, inserts { name, sku, priceCents }, revalidates /products', async () => {
    await createProduct(fd({ name: 'Sprocket', sku: 'SKU-9', priceCents: '500' }));

    expect(fake.withPermission).toHaveBeenCalledWith(
      'create',
      'Product',
      expect.any(Function),
    );
    expect(fake.insertValues).toHaveBeenCalledWith({
      name: 'Sprocket',
      sku: 'SKU-9',
      priceCents: 500,
    });
    expect(fake.revalidatePath).toHaveBeenCalledWith('/products');
  });

  it('rejects a blank name with the schema message, AFTER consulting the limiter', async () => {
    await expect(
      createProduct(fd({ name: '', sku: 'SKU-9', priceCents: '1' })),
    ).rejects.toThrow('Product name is required');

    expect(fake.insertValues).not.toHaveBeenCalled();
    expect(fake.revalidatePath).not.toHaveBeenCalled();
    expect(fake.calls).toEqual(['guard', 'limiter']);
  });

  it('rejects a negative price with the schema message', async () => {
    await expect(
      createProduct(fd({ name: 'X', sku: 'SKU-9', priceCents: '-1' })),
    ).rejects.toThrow(/non-negative/i);
    expect(fake.insertValues).not.toHaveBeenCalled();
  });

  it('propagates a throttle rejection and never inserts or revalidates', async () => {
    fake.withRateLimit.mockReset();
    fake.withRateLimit.mockRejectedValue(new Error('Rate limit exceeded. Retry in 1s'));

    await expect(
      createProduct(fd({ name: 'X', sku: 'SKU-9', priceCents: '1' })),
    ).rejects.toThrow('Rate limit exceeded. Retry in 1s');
    expect(fake.insertValues).not.toHaveBeenCalled();
    expect(fake.revalidatePath).not.toHaveBeenCalled();
  });
});

describe('app/_features/products updateProduct', () => {
  it('guards update/Product, sets { name, sku, priceCents } by id, revalidates', async () => {
    await updateProduct(fd({ id: ID, name: 'Renamed', sku: 'SKU-2', priceCents: '250' }));

    expect(fake.withPermission).toHaveBeenCalledWith(
      'update',
      'Product',
      expect.any(Function),
    );
    expect(fake.updateSet).toHaveBeenCalledWith({
      name: 'Renamed',
      sku: 'SKU-2',
      priceCents: 250,
    });
    expect(fake.updateWhere).toHaveBeenCalled();
    expect(fake.revalidatePath).toHaveBeenCalledWith('/products');
  });

  it('rejects a non-uuid id without touching the database', async () => {
    await expect(
      updateProduct(fd({ id: 'not-a-uuid', name: 'X', sku: 'S', priceCents: '1' })),
    ).rejects.toThrow();
    expect(fake.updateSet).not.toHaveBeenCalled();
  });
});

describe('app/_features/products retireProduct', () => {
  it('guards delete/Product, sets retired=true by id, revalidates', async () => {
    await retireProduct(fd({ id: ID }));

    expect(fake.withPermission).toHaveBeenCalledWith(
      'delete',
      'Product',
      expect.any(Function),
    );
    expect(fake.updateSet).toHaveBeenCalledWith({ retired: true });
    expect(fake.updateWhere).toHaveBeenCalled();
    expect(fake.revalidatePath).toHaveBeenCalledWith('/products');
  });
});

describe('app/_features/products getProducts', () => {
  it('guards read/Product and resolves rows from the tx chain', async () => {
    const result = await getProducts();

    expect(fake.withPermission).toHaveBeenCalledWith(
      'read',
      'Product',
      expect.any(Function),
    );
    expect(result).toEqual(fake.rows);
    expect(fake.calls).toEqual(['guard', 'context']);
  });
});
