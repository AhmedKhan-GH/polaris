// This file contains unit tests for the organization creation action defined in app/_features/orgs/actions.ts.
// The tests use Vitest and heavily mock the database and permission layers to focus on the logic of the action itself.
// The tests verify that the organization and membership are created correctly, that the organization name is trimmed, and that invalid input is rejected before starting a transaction.
// Command to run these tests: `npm run test -- app/_features/orgs/actions.test.ts`

import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

// Hoisted mocks let the server action import after the seams are replaced.
const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withRateLimit: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
  insert: vi.fn(),
  randomUUID: vi.fn(),
  inserted: [] as unknown[],
  calls: [] as string[],
}));

vi.mock('node:crypto', () => ({
  randomUUID: fake.randomUUID,
}));
vi.mock('@/lib/permissions/guard', () => ({
  withPermission: fake.withPermission,
}));
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ __limiter: true })),
  withRateLimit: fake.withRateLimit,
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    transaction: fake.transaction,
  },
}));

import { createOrganization } from './actions';

function txStub() {
  // This is just enough Drizzle shape for the action path.
  return {
    execute: fake.execute,
    insert: fake.insert,
  };
}

beforeEach(() => {
  fake.withPermission.mockReset();
  fake.withRateLimit.mockReset();
  fake.transaction.mockReset();
  fake.execute.mockReset();
  fake.insert.mockReset();
  fake.randomUUID.mockReset();
  fake.inserted.length = 0;
  fake.calls.length = 0;

  fake.randomUUID.mockReturnValue(ORG_ID);
  fake.withPermission.mockImplementation(async (_action, _subject, fn) => {
    fake.calls.push('guard');
    return fn({ userId: USER_ID, roles: [] });
  });
  fake.withRateLimit.mockImplementation(async (_limiter, _key, fn) => {
    fake.calls.push('limiter');
    return fn();
  });
  fake.transaction.mockImplementation(async (fn) => {
    fake.calls.push('transaction');
    return fn(txStub());
  });
  fake.execute.mockResolvedValue(undefined);
  fake.insert.mockImplementation(() => ({
    values: vi.fn(async (values) => {
      fake.inserted.push(values);
    }),
  }));
});

describe('createOrganization', () => {
  it('creates the organization and admin membership in one transaction', async () => {
    const result = await createOrganization({ name: 'Cold Chain' });

    // The action returns the org id it generated.
    expect(result).toEqual({ id: ORG_ID });
    expect(fake.withPermission).toHaveBeenCalledWith(
      'create',
      'Organization',
      expect.any(Function),
    );
    expect(fake.withRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      `orgs:create:${USER_ID}`,
      expect.any(Function),
    );
    expect(fake.transaction).toHaveBeenCalledTimes(1);
    // Both rows must be written before the transaction commits.
    expect(fake.inserted).toEqual([
      { id: ORG_ID, name: 'Cold Chain', createdBy: USER_ID },
      { orgId: ORG_ID, userId: USER_ID, role: 'org_admin' },
    ]);
    expect(fake.calls).toEqual(['guard', 'limiter', 'transaction']);
  });

  it('trims the organization name before inserting', async () => {
    await createOrganization({ name: '  Cold Chain  ' });

    expect(fake.inserted[0]).toEqual({
      id: ORG_ID,
      name: 'Cold Chain',
      createdBy: USER_ID,
    });
  });

  it('rejects an empty name before opening the transaction', async () => {
    await expect(createOrganization({ name: '   ' })).rejects.toThrow(
      'Organization name is required',
    );

    expect(fake.transaction).not.toHaveBeenCalled();
    expect(fake.inserted).toEqual([]);
    // Guard and limiter run before validation by design.
    expect(fake.calls).toEqual(['guard', 'limiter']);
  });
});
