// @vitest-environment node
//
// withUserContext unit contract (lib/db/with-user-context). Runs in the `node`
// environment because the unit under test is Node-side DB plumbing. The DB
// client is mocked so these cycles assert the fail-closed validation and the
// transaction wiring WITHOUT touching a real Postgres — the live GUC behaviour
// is proven separately in the integration suite.
//
// The mock is hoisted by `vi.mock` so `@/lib/db/client` is replaced before the
// unit imports it. `db.transaction` simply invokes its callback with a stub tx
// exposing `execute`, letting us observe whether (and how) it was called.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: { transaction: vi.fn(async (cb) => cb({ execute: vi.fn() })) },
}));

import { db } from '@/lib/db/client';

import { withUserContext } from './with-user-context';

const transaction = vi.mocked(db.transaction);

beforeEach(() => {
  transaction.mockClear();
});

describe('lib/db withUserContext', () => {
  it('rejects an empty userId without opening a transaction', async () => {
    await expect(
      withUserContext({ userId: '', roles: [] }, async () => 'ok'),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a malformed userId with a UUID message and no transaction', async () => {
    await expect(
      withUserContext({ userId: 'not-a-uuid', roles: [] }, async () => 'ok'),
    ).rejects.toThrow('userId must be a UUID');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('opens one transaction and resolves to fn(tx) for a valid context', async () => {
    let received: unknown;
    const result = await withUserContext(
      { userId: '11111111-1111-1111-1111-111111111111', roles: [] },
      async (tx) => {
        received = tx;
        return 'ok';
      },
    );
    expect(result).toBe('ok');
    expect(transaction).toHaveBeenCalledTimes(1);
    // fn must run against the transaction handle the mock supplied (exposes execute).
    expect(received).toHaveProperty('execute');
  });
});
