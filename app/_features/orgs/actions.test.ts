// Unit tests for the org server actions in app/_features/orgs/actions.ts.
// They mock the guard, limiter, DB, and org context so we can test action logic only.
// Covers createOrganization, addMemberByEmail, and listOrgMembers.
// Command to run these tests: `npm run test -- app/_features/orgs/actions.test.ts`

import { beforeEach, describe, expect, it, vi } from "vitest";

// Fakes for testing. These are not real users, but they must exist in the test DB.
const USER_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_USER_ID = "22222222-2222-2222-2222-222222222222";
const ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

// Hoisted mocks let the server action import after the seams are replaced
const fake = vi.hoisted(() => ({
  withPermission: vi.fn(),
  withRateLimit: vi.fn(),
  withOrgContext: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
  insert: vi.fn(),
  onConflictDoNothing: vi.fn(),
  randomUUID: vi.fn(),
  inserted: [] as unknown[],
  calls: [] as string[],
}));

// Mock the dependencies of the org actions so we can test them in isolation.
vi.mock("node:crypto", () => ({
  default: { randomUUID: fake.randomUUID },
  randomUUID: fake.randomUUID,
}));
// Mock the auth guard, rate limiter, and DB so we can test the org actions in isolation.
vi.mock("@/lib/permissions/guard", () => ({
  withPermission: fake.withPermission,
}));
// Mock the rate limiter so we can test the org actions in isolation.
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: vi.fn(() => ({ __limiter: true })),
  withRateLimit: fake.withRateLimit,
}));
vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: fake.transaction,
  },
}));
// Mock the org context so we can test the org actions in isolation.
vi.mock("@/lib/db/with-org-context", () => ({
  withOrgContext: fake.withOrgContext,
}));

import {
  addMemberByEmail,
  createOrganization,
  listOrgMembers,
} from "./actions";

function txStub() {
  // This is just enough Drizzle shape for the action path.
  return {
    execute: fake.execute,
    insert: fake.insert,
  };
}

// Reset the fakes before each test so they don't interfere with each other.
beforeEach(() => {
  fake.withPermission.mockReset();
  fake.withRateLimit.mockReset();
  fake.withOrgContext.mockReset();
  fake.transaction.mockReset();
  fake.execute.mockReset();
  fake.insert.mockReset();
  fake.onConflictDoNothing.mockReset();
  fake.randomUUID.mockReset();
  fake.inserted.length = 0;
  fake.calls.length = 0;

  // Set up the fakes to return the expected values for the tests.
  fake.randomUUID.mockReturnValue(ORG_ID);
  fake.withPermission.mockImplementation(async (_action, _subject, fn) => {
    fake.calls.push("guard");
    return fn({ userId: USER_ID, roles: [] });
  });
  fake.withRateLimit.mockImplementation(async (_limiter, _key, fn) => {
    fake.calls.push("limiter");
    return fn();
  });
  fake.withOrgContext.mockImplementation(async (_ctx, fn) => {
    fake.calls.push("org-context");
    return fn(txStub());
  });
  fake.transaction.mockImplementation(async (fn) => {
    fake.calls.push("transaction");
    return fn(txStub());
  });
  fake.execute.mockResolvedValue(undefined);
  fake.insert.mockImplementation(() => ({
    values: vi.fn((values) => {
      fake.inserted.push(values);
      return { onConflictDoNothing: fake.onConflictDoNothing };
    }),
  }));
  fake.onConflictDoNothing.mockResolvedValue(undefined);
});

// The tests below are unit tests that use mocks to isolate the org actions from their dependencies.
describe("createOrganization", () => {
  it("creates the organization and admin membership in one transaction", async () => {
    const result = await createOrganization({ name: "Cold Chain" });

    // The action returns the org id it generated.
    expect(result).toEqual({ id: ORG_ID });
    expect(fake.withPermission).toHaveBeenCalledWith(
      "create",
      "Organization",
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
      { id: ORG_ID, name: "Cold Chain", createdBy: USER_ID },
      { orgId: ORG_ID, userId: USER_ID, role: "org_admin" },
    ]);
    expect(fake.calls).toEqual(["guard", "limiter", "transaction"]);
  });

  it("trims the organization name before inserting", async () => {
    await createOrganization({ name: "  Cold Chain  " });

    expect(fake.inserted[0]).toEqual({
      id: ORG_ID,
      name: "Cold Chain",
      createdBy: USER_ID,
    });
  });

  it("rejects an empty name before opening the transaction", async () => {
    await expect(createOrganization({ name: "   " })).rejects.toThrow(
      "Organization name is required",
    );

    expect(fake.transaction).not.toHaveBeenCalled();
    expect(fake.inserted).toEqual([]);
    // Guard and limiter run before validation by design.
    expect(fake.calls).toEqual(["guard", "limiter"]);
  });
});

// The tests below are unit tests that use mocks to isolate the org actions from their dependencies.
describe("addMemberByEmail", () => {
  it("lets an org_admin add an existing user by email", async () => {
    fake.execute
      .mockResolvedValueOnce({ rows: [{ role: "org_admin" }] })
      .mockResolvedValueOnce({ rows: [{ user_id: TARGET_USER_ID }] });

    await addMemberByEmail(ORG_ID, {
      email: "new@example.com",
      role: "org_member",
    });

    expect(fake.withPermission).toHaveBeenCalledWith(
      "manage",
      "Membership",
      expect.any(Function),
    );
    expect(fake.withOrgContext).toHaveBeenCalledWith(
      { userId: USER_ID, orgId: ORG_ID },
      expect.any(Function),
    );
    expect(fake.inserted).toEqual([
      { orgId: ORG_ID, userId: TARGET_USER_ID, role: "org_member" },
    ]);
    expect(fake.onConflictDoNothing).toHaveBeenCalledWith({
      target: expect.any(Array),
    });
  });

  it("denies an org_member before inserting", async () => {
    fake.execute.mockResolvedValueOnce({ rows: [{ role: "org_member" }] });

    await expect(
      addMemberByEmail(ORG_ID, {
        email: "new@example.com",
        role: "org_member",
      }),
    ).rejects.toThrow("Not authorized");

    expect(fake.inserted).toEqual([]);
  });

  it("throws a friendly error for an unknown email", async () => {
    fake.execute
      .mockResolvedValueOnce({ rows: [{ role: "org_admin" }] })
      .mockResolvedValueOnce({ rows: [{ user_id: null }] });

    await expect(
      addMemberByEmail(ORG_ID, {
        email: "missing@example.com",
        role: "org_member",
      }),
    ).rejects.toThrow("No user found for that email");

    expect(fake.inserted).toEqual([]);
  });

  it("rejects an invalid email before inserting", async () => {
    fake.execute.mockResolvedValueOnce({ rows: [{ role: "org_admin" }] });

    await expect(
      addMemberByEmail(ORG_ID, {
        email: "not-an-email",
        role: "org_member",
      }),
    ).rejects.toThrow("Valid email is required");

    expect(fake.inserted).toEqual([]);
  });
});

describe("listOrgMembers", () => {
  it("reads members inside the org context", async () => {
    fake.execute.mockResolvedValueOnce({
      rows: [
        { userId: USER_ID, email: "a@example.com", role: "org_admin" },
        {
          userId: TARGET_USER_ID,
          email: "b@example.com",
          role: "org_member",
        },
      ],
    });

    const rows = await listOrgMembers(ORG_ID);

    expect(fake.withPermission).toHaveBeenCalledWith(
      "read",
      "Membership",
      expect.any(Function),
    );
    expect(fake.withOrgContext).toHaveBeenCalledWith(
      { userId: USER_ID, orgId: ORG_ID },
      expect.any(Function),
    );
    expect(rows).toEqual([
      { userId: USER_ID, email: "a@example.com", role: "org_admin" },
      { userId: TARGET_USER_ID, email: "b@example.com", role: "org_member" },
    ]);
  });

  it("keeps null member emails as null", async () => {
    fake.execute.mockResolvedValueOnce({
      rows: [{ userId: USER_ID, email: null, role: "org_admin" }],
    });

    await expect(listOrgMembers(ORG_ID)).resolves.toEqual([
      { userId: USER_ID, email: null, role: "org_admin" },
    ]);
  });
});
