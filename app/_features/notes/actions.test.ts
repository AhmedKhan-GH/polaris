// @vitest-environment node
//
// notes server actions PIPELINE contract (app/_features/notes/actions).
//
// Runs in the `node` environment: server-side action plumbing. Every foundation
// seam is hoisted-mocked so the cycles assert the PIPELINE ORDER and wiring —
// guard → limiter → validate → context, then redirect only on success — WITHOUT a
// real session, ability, limiter store, Postgres, or Next runtime. Live behaviours
// (real CASL + RLS + limiter) are proven in the integration suite.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = '11111111-1111-1111-1111-111111111111';

const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withRateLimit: vi.fn(),
  withUserContext: vi.fn(),
  redirect: vi.fn(),
  /** Every value object passed to `insert(...).values(...)`, in order. */
  inserted: [] as unknown[],
  rows: [
    { id: 'n1', createdBy: '11111111-1111-1111-1111-111111111111', title: 'Hi', body: 'hi', createdAt: new Date('2026-01-01T00:00:00Z') },
  ] as unknown[],
  /** Records the order in which the pipeline stages were entered. */
  calls: [] as string[],
}));

vi.mock('@/lib/permissions/guard', () => ({ withPermission: fake.withPermission }));
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ __limiter: true })),
  withRateLimit: fake.withRateLimit,
}));
vi.mock('@/lib/db/with-user-context', () => ({ withUserContext: fake.withUserContext }));
vi.mock('next/navigation', () => ({ redirect: fake.redirect }));

import { createNote, getNotes } from './actions';

/** A drizzle-shaped chainable tx stub: `insert().values(v)` records `v`; `select().from().orderBy()` resolves rows. */
function txStub(rows: unknown[]) {
  const chain = {
    insert: vi.fn(() => ({
      values: (v: unknown) => {
        fake.inserted.push(v);
        return { returning: async () => [{ id: 'n1' }] };
      },
    })),
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    orderBy: vi.fn(async () => rows),
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
  fake.redirect.mockReset();
  fake.inserted.length = 0;
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
});

describe('app/_features/notes createNote', () => {
  it('inserts the immutable note and redirects to the new note on a valid input', async () => {
    await createNote(fd('hello world'));

    expect(fake.inserted).toContainEqual({ createdBy: ME, title: 'Note', body: 'hello world' });
    expect(fake.redirect).toHaveBeenCalledWith('/notes?note=n1');
  });

  it('rejects a note without a title, without inserting or redirecting — but only AFTER the limiter (validation lives inside it)', async () => {
    await expect(createNote(fd('some body', ''))).rejects.toThrow('Title is required');

    expect(fake.inserted).toHaveLength(0);
    expect(fake.redirect).not.toHaveBeenCalled();
    expect(fake.calls).toEqual(['guard', 'limiter']);
  });

  it('propagates a throttle rejection and never inserts or redirects', async () => {
    fake.withRateLimit.mockReset();
    fake.withRateLimit.mockRejectedValue(new Error('Rate limit exceeded. Retry in 1s'));

    await expect(createNote(fd('hello'))).rejects.toThrow('Rate limit exceeded. Retry in 1s');
    expect(fake.inserted).toHaveLength(0);
    expect(fake.redirect).not.toHaveBeenCalled();
  });
});

describe('app/_features/notes getNotes', () => {
  it('guards the read with read/Note and resolves rows from the tx chain', async () => {
    const result = await getNotes();

    expect(fake.withPermission).toHaveBeenCalledWith('read', 'Note', expect.any(Function));
    expect(result).toEqual(fake.rows);
    expect(fake.calls).toEqual(['guard', 'context']);
  });
});
