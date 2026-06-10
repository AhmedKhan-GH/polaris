// @vitest-environment node
//
// getSignInLog read-model contract (app/_features/activity/getSignInLog).
//
// Runs in the `node` environment: this is server-side DB plumbing. Both guards
// are hoisted-mocked so the cycles assert the PIPELINE — that the query is
// wrapped in `withPermission('read','SignInLog', ...)` and, only when that
// passes, run inside `withUserContext` against the request-scoped tx — WITHOUT a
// real session, ability, or Postgres. The live owner-only RLS behaviour is
// proven separately in the integration suite.
//
// `withPermission` mock is a pass-through: it invokes `fn` with a ctx, so the
// inner pipeline runs. `withUserContext` invokes `fn` with a chainable tx stub
// whose terminal `limit` resolves to the rows, mirroring the drizzle builder.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withUserContext: vi.fn(),
  rows: [
    {
      id: 'r1',
      userId: 'u1',
      email: 'owner@example.com',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  ] as unknown[],
  /** Records the order in which the two guards were entered. */
  calls: [] as string[],
}));

vi.mock('@/lib/permissions/guard', () => ({
  withPermission: fake.withPermission,
}));
vi.mock('@/lib/db/with-user-context', () => ({
  withUserContext: fake.withUserContext,
}));

import { getSignInLog } from './getSignInLog';

/** A drizzle-shaped chainable tx whose terminal `limit` resolves to `rows`. */
function txReturning(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

beforeEach(() => {
  fake.withPermission.mockReset();
  fake.withUserContext.mockReset();
  fake.calls.length = 0;

  // Pass-through guard: records entry, then runs the inner pipeline with a ctx.
  fake.withPermission.mockImplementation(async (_action, _subject, fn) => {
    fake.calls.push('guard');
    return fn({ userId: 'u1', roles: ['owner'] });
  });
  // Context: records entry, then runs fn against a chainable tx stub.
  fake.withUserContext.mockImplementation(async (_ctx, fn) => {
    fake.calls.push('context');
    return fn(txReturning(fake.rows));
  });
});

describe('app/_features/activity getSignInLog', () => {
  it('guards the read with read/SignInLog and resolves rows from the tx chain', async () => {
    const result = await getSignInLog();

    expect(fake.withPermission).toHaveBeenCalledWith(
      'read',
      'SignInLog',
      expect.any(Function),
    );
    expect(result).toEqual(fake.rows);
  });

  it('runs the guard before the user context (defense in depth, in order)', async () => {
    await getSignInLog();

    expect(fake.calls).toEqual(['guard', 'context']);
  });

  it('propagates a guard rejection and never opens the user context', async () => {
    fake.withPermission.mockReset();
    fake.withPermission.mockRejectedValue(new Error('Not authorized'));

    await expect(getSignInLog()).rejects.toThrow('Not authorized');
    expect(fake.withUserContext).not.toHaveBeenCalled();
  });
});
