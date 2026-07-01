// @vitest-environment node
//
// notes server actions PIPELINE contract (app/_features/notes/actions).
//
// Runs in the `node` environment: this is server-side action plumbing. Every
// foundation seam is hoisted-mocked so the cycles assert the PIPELINE ORDER and
// wiring — guard → limiter → validate → context, then revalidate only on success
// — WITHOUT a real session, ability, limiter store, Postgres, or Next cache. The
// live behaviours (real CASL + RLS + limiter + the version chain) are proven in
// the integration suite.
//
// Mock shapes:
//   - `@/lib/permissions/guard` withPermission: pass-through that invokes `fn`
//     with a fixed ctx (records 'guard'), so the inner pipeline runs.
//   - `@/lib/rate-limit` withRateLimit: pass-through spy that invokes `fn`
//     (records 'limiter'); a per-test override can make it reject (throttle).
//   - `@/lib/db/with-user-context` withUserContext: invokes `fn` with a
//     chainable tx stub (records 'context'). The stub supports `transaction(fn)`
//     (createNote's write-through), `insert().values()[.returning()]`, and
//     `select().from().orderBy()`.
//   - `next/cache` revalidatePath: spy, asserted called only on success.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = '11111111-1111-1111-1111-111111111111';

const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withRateLimit: vi.fn(),
  withUserContext: vi.fn(),
  revalidatePath: vi.fn(),
  /** Every value object passed to an `insert(...).values(...)`, in order. */
  inserted: [] as unknown[],
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
 * A drizzle-shaped chainable tx stub. `insert(...).values(v)` records `v` and
 * resolves; the returned thenable also carries `.returning()` (yielding a fixed
 * new id) for the write-through. `transaction(fn)` runs `fn` with the same chain;
 * `select().from().orderBy()` resolves to `rows`.
 */
function txStub(rows: unknown[]) {
  const values = vi.fn((v: unknown) => {
    fake.inserted.push(v);
    const p = Promise.resolve(undefined) as Promise<undefined> & {
      returning?: () => Promise<Array<{ id: string }>>;
    };
    p.returning = vi.fn(async () => [{ id: 'new-note-id' }]);
    return p;
  });
  const chain = {
    insert: vi.fn(() => ({ values })),
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    orderBy: vi.fn(async () => rows),
    transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(chain)),
  };
  return chain;
}

function fd(body: string | null, title = 'Note'): FormData {
  const f = new FormData();
  if (body !== null) f.set('body', body);
  f.set('title', title);
  return f;
}

beforeEach(() => {
  fake.withPermission.mockReset();
  fake.withRateLimit.mockReset();
  fake.withUserContext.mockReset();
  fake.revalidatePath.mockReset();
  fake.inserted.length = 0;
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
});

describe('app/_features/notes createNote', () => {
  it('write-through: inserts the note AND its genesis version (seq 1), then revalidates', async () => {
    await createNote(fd('hello world'));

    // The note projection…
    expect(fake.inserted).toContainEqual({ createdBy: ME, title: 'Note', body: 'hello world' });
    // …and the genesis version, in the same transaction.
    expect(fake.inserted).toContainEqual({
      noteId: 'new-note-id',
      seq: 1,
      title: 'Note',
      body: 'hello world',
      editedBy: ME,
    });
    expect(fake.revalidatePath).toHaveBeenCalledWith('/notes');
  });

  it('rejects a note without a title, without inserting or revalidating — but only AFTER consulting the limiter (validation lives inside it)', async () => {
    await expect(createNote(fd('some body', ''))).rejects.toThrow('Title is required');

    expect(fake.inserted).toHaveLength(0);
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
    expect(fake.inserted).toHaveLength(0);
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
