// DB/RLS integration tests for adding org members.
// This lives under lib/db because it tests the database policies directly.
// Command: `npm run test:integration -- lib/db/__tests__/add-member-by-email-rls.integration.test.ts`

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startRlsTestDb } from "./rls-test-db";

// Fake users for testing. These are not real users, but they must exist in the test DB.
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const USER_C = "33333333-3333-3333-3333-333333333333";
const ORG_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

// Mock the session user for testing. The tests will set this to different users as needed.
describe("add member RLS (testcontainer)", (): void => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>> | undefined;
  let db: typeof import("@/lib/db/client").db | undefined;
  let withOrgContext: typeof import("@/lib/db/with-org-context").withOrgContext;
  let withUserContext: typeof import("@/lib/db/with-user-context").withUserContext;
  let memberships: typeof import("@/lib/db/schema").memberships;
  let organizations: typeof import("@/lib/db/schema").organizations;

  // Before all tests, start the RLS test database and set up the environment.
  beforeAll(async (): Promise<void> => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;

    // Import the DB client and other modules after the test DB is started, so they use the correct connection string.
    ({ db } = await import("@/lib/db/client"));
    ({ withOrgContext } = await import("@/lib/db/with-org-context"));
    ({ withUserContext } = await import("@/lib/db/with-user-context"));
    ({ memberships, organizations } = await import("@/lib/db/schema"));

    // Profiles must exist before memberships can point at them.
    await rls.admin.query(
      "insert into profiles (id, email, role) values ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)",
      [
        USER_A,
        "a@example.com",
        "member",
        USER_B,
        "b@example.com",
        "member",
        USER_C,
        "c@example.com",
        "member",
      ],
    );
    // Create an organization
    await rls.admin.query(
      "insert into organizations (id, name, created_by) values ($1, $2, $3)",
      [ORG_A_ID, "Org A", USER_A],
    );

    // USER_A starts as the org admin.
    await rls.admin.query(
      "insert into memberships (org_id, user_id, role) values ($1, $2, $3)",
      [ORG_A_ID, USER_A, "org_admin"],
    );
  });

  afterAll(async (): Promise<void> => {
    await db?.$client.end();
    await rls?.cleanup();
  });

  // The tests below are integration tests that use a real database with RLS enabled.
  it("lets an org_admin add a member and treats duplicates as harmless", async (): Promise<void> => {
    await withOrgContext({ userId: USER_A, orgId: ORG_A_ID }, async (tx) => {
      await tx
        .insert(memberships)
        .values({ orgId: ORG_A_ID, userId: USER_B, role: "org_member" })
        .onConflictDoNothing({
          target: [memberships.orgId, memberships.userId],
        });

      // Same row again should not crash.
      await tx
        .insert(memberships)
        .values({ orgId: ORG_A_ID, userId: USER_B, role: "org_member" })
        .onConflictDoNothing({
          target: [memberships.orgId, memberships.userId],
        });
    });

    const bOrgs = await withUserContext({ userId: USER_B, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );

    expect(bOrgs.map((row) => row.id)).toEqual([ORG_A_ID]);
  });

  // This test ensures that an org_member cannot add another member, which should be prevented by RLS policies.
  it("denies an org_member attempting to add another member", async (): Promise<void> => {
    const rejection = await withOrgContext(
      { userId: USER_B, orgId: ORG_A_ID },
      async (tx) =>
        tx
          .insert(memberships)
          .values({ orgId: ORG_A_ID, userId: USER_C, role: "org_member" }),
    ).then(
      () => null,
      (err: unknown) => err as { cause?: { message?: string } },
    );

    // The rejection should indicate that the operation was denied due to row-level security policies.
    expect(rejection).not.toBeNull();
    expect(rejection?.cause?.message).toMatch(/row-level security|policy/i);

    const cOrgs = await withUserContext({ userId: USER_C, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );
    expect(cOrgs).toEqual([]);
  });
  
  // This test ensures that a non-member cannot perform any operations within the organization context, which should be prevented by RLS policies.
  it("refuses a non-member before a scoped member read can run", async (): Promise<void> => {
    let fnRan = false;

    await expect(
      withOrgContext({ userId: USER_C, orgId: ORG_A_ID }, async () => {
        fnRan = true;
        return [];
      }),
    ).rejects.toThrow("Not a member");

    expect(fnRan).toBe(false);
  });
});
