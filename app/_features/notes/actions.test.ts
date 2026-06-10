// @vitest-environment node
//
// notes server actions PIPELINE contract (app/_features/notes/actions).
//
// Runs in the `node` environment: this is server-side action plumbing. Every
// foundation seam is hoisted-mocked so the cycles assert the PIPELINE ORDER and
// wiring — guard → limiter → validate → context, then revalidate only on success
// — WITHOUT a real session, ability, limiter store, Postgres, or Next cache. The
// live behaviours (real CASL + RLS + limiter) are proven in the integration
// suite.
//
// Mock shapes:
//   - `@/lib/permissions/guard` withPermission: pass-through that invokes `fn`
//     with a fixed ctx (records 'guard'), so the inner pipeline runs.
//   - `@/lib/rate-limit` withRateLimit: pass-through spy that invokes `fn`
//     (records 'limiter'); a per-test override can make it reject (throttle).
//     `createRateLimiter` is a no-op stub (the action constructs one at module
//     load; we never exercise the real store here).
//   - `@/lib/db/with-user-context` withUserContext: invokes `fn` with a
//     chainable tx stub (records 'context'); the tx's `insert().values()`
//     resolves, and `select().from().orderBy()` resolves to seeded rows.
//   - `next/cache` revalidatePath: spy, asserted called only on success.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = '11111111-1111-1111-1111-111111111111';

const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withRateLimit: vi.fn(),
  withUserContext: vi.fn(),
  revalidatePath: vi.fn(),
  insertValues: vi.fn(),
  rows: [
    { id: 'n1', createdBy: '11111111-1111-1111-1111-111111111111', body: 'hi', createdAt: new Date('2026-01-01T00:00:00Z') },
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

import { createNote, getNotes } from './actions';

/**
 * A drizzle-shaped chainable tx stub. `insert(...).values(...)` records the
 * inserted values and resolves; `select().from().orderBy()` resolves to `rows`.
 */
function txStub(rows: unknown[]) {
  const chain = {
    insert: vi.fn(() => ({ values: fake.insertValues })),
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    orderBy: vi.fn(async () => rows),
  };
  return chain;
}

function fd(body: string | null): FormData {
  const f = new FormData();
  if (body !== null) f.set('body', body);
  return f;
}

beforeEach(() => {
  fake.withPermission.mockReset();
  fake.withRateLimit.mockReset();
  fake.withUserContext.mockReset();
  fake.revalidatePath.mockReset();
  fake.insertValues.mockReset();
  fake.calls.length = 0;

  // Pass-through guard: records entry, then runs the inner pipeline with a ctx.
  fake.withPermission.mockImplementation(async (_action, _subject, fn) => {
    fake.calls.push('guard');
    return fn({ userId: ME, roles: [] });
  });
  // Pass-through limiter: records entry, then runs the wrapped work.
  fake.withRateLimit.mockImplementation(async (_limiter, _key, fn) => {
    fake.calls.push('limiter');
    return fn();
  });
  // Context: records entry, then runs fn against a chainable tx stub.
  fake.withUserContext.mockImplementation(async (_ctx, fn) => {
    fake.calls.push('context');
    return fn(txStub(fake.rows));
  });
  fake.insertValues.mockResolvedValue(undefined);
});

describe('app/_features/notes createNote', () => {
  it('inserts { createdBy, body } and revalidates /notes on a valid body', async () => {
    await createNote(fd('hello world'));

    expect(fake.insertValues).toHaveBeenCalledWith({
      createdBy: ME,
      body: 'hello world',
    });
    expect(fake.revalidatePath).toHaveBeenCalledWith('/notes');
  });

  it('rejects an empty body with the schema message, without inserting or revalidating — but only AFTER consulting the limiter (validation lives inside it)', async () => {
    await expect(createNote(fd(''))).rejects.toThrow('Note body is required');

    expect(fake.insertValues).not.toHaveBeenCalled();
    expect(fake.revalidatePath).not.toHaveBeenCalled();
    // Order proof: the guard and limiter were both entered before validation
    // threw, so abusive invalid spam still consumes the throttle budget.
    expect(fake.calls).toEqual(['guard', 'limiter']);
  });

  it('propagates a throttle rejection and never inserts or revalidates', async () => {
    fake.withRateLimit.mockReset();
    fake.withRateLimit.mockRejectedValue(
      new Error('Rate limit exceeded. Retry in 1s'),
    );

    await expect(createNote(fd('hello'))).rejects.toThrow(
      'Rate limit exceeded. Retry in 1s',
    );
    expect(fake.insertValues).not.toHaveBeenCalled();
    expect(fake.revalidatePath).not.toHaveBeenCalled();
  });
});

describe('app/_features/notes getNotes', () => {
  it('guards the read with read/Note and resolves rows from the tx chain', async () => {
    const result = await getNotes();

    expect(fake.withPermission).toHaveBeenCalledWith(
      'read',
      'Note',
      expect.any(Function),
    );
    expect(result).toEqual(fake.rows);
    // Read path runs through the guard then the user context (RLS-scoped).
    expect(fake.calls).toEqual(['guard', 'context']);
  });
});
