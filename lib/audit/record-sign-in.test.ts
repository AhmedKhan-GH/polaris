// @vitest-environment node
//
// recordSignIn unit contract (lib/audit/record-sign-in). Runs in the `node`
// environment because the unit is server-side DB plumbing: it writes a row to
// `sign_in_log`. Both the DB client and the logger are mocked so these cycles
// assert the insert wiring and the best-effort fail-open behaviour WITHOUT
// touching a real Postgres — RLS/grant behaviour is proven in the integration
// suite.
//
// Mocks are hoisted via `vi.hoisted` so `@/lib/db/client` and `@/lib/logger`
// are replaced before the unit imports them. `db.insert(...).values(...)` is a
// fluent chain whose terminal `values` is the awaited promise; the stub returns
// that promise so a single cycle can make it resolve or reject.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  const warn = vi.fn();
  return { values, insert, warn };
});

vi.mock('@/lib/db/client', () => ({ db: { insert: fake.insert } }));
vi.mock('@/lib/logger', () => ({ logger: { warn: fake.warn } }));

import { signInLog } from '@/lib/db/schema';

import { recordSignIn } from './record-sign-in';

beforeEach(() => {
  fake.values.mockReset();
  fake.values.mockResolvedValue(undefined);
  fake.insert.mockClear();
  fake.warn.mockReset();
});

describe('lib/audit recordSignIn', () => {
  it('inserts exactly { userId, email } into sign_in_log and resolves without warning', async () => {
    await expect(
      recordSignIn({ userId: 'u1', email: 'a@b.com' }),
    ).resolves.toBeUndefined();

    expect(fake.insert).toHaveBeenCalledTimes(1);
    expect(fake.insert).toHaveBeenCalledWith(signInLog);
    expect(fake.values).toHaveBeenCalledTimes(1);
    expect(fake.values).toHaveBeenCalledWith({ userId: 'u1', email: 'a@b.com' });
    expect(fake.warn).not.toHaveBeenCalled();
  });

  it('never throws when the insert fails; warns once instead', async () => {
    fake.values.mockRejectedValueOnce(new Error('db down'));

    await expect(
      recordSignIn({ userId: 'u1', email: 'a@b.com' }),
    ).resolves.toBeUndefined();

    expect(fake.warn).toHaveBeenCalledTimes(1);
    expect(fake.warn).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com' }),
      'failed to write sign_in_log',
    );
  });

  it('accepts a null userId and passes it through unchanged', async () => {
    await expect(
      recordSignIn({ userId: null, email: 'a@b.com' }),
    ).resolves.toBeUndefined();

    expect(fake.values).toHaveBeenCalledWith({ userId: null, email: 'a@b.com' });
    expect(fake.warn).not.toHaveBeenCalled();
  });
});
