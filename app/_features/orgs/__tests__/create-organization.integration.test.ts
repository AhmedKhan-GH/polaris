// This file contains an integration test for the createOrganization action defined in app/_features/orgs/actions.ts.
// The test uses a testcontainer Postgres instance with the real schema and migrations applied, and it mocks only the session to provide a fixed user context.
// The test verifies that the organization is created and that the creating user is assigned the org_admin role in the memberships table, and that the new org is visible to the creator but not to another user due to RLS.
// Command to run this test: `npm run test:integration -- app/_features/orgs/__tests__/create-organization.integration.test.ts`

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { startRlsTestDb } from "@/lib/db/__tests__/rls-test-db";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

// Hoisted mock for session to provide a fixed user context for the action.
const fake = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
}));
// Mock the session to control the user context for the action.
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: fake.getSessionUser,
}));
// The testcontainer setup provides a real Postgres instance with the schema and migrations, so we can test the full integration of the action with the database and RLS policies.
describe("createOrganization integration", () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>> | undefined;
  let db: typeof import("@/lib/db/client").db | undefined;
  let createOrganization: typeof import("../actions").createOrganization;
  let withUserContext: typeof import("@/lib/db/with-user-context").withUserContext;
  let organizations: typeof import("@/lib/db/schema").organizations;
  let memberships: typeof import("@/lib/db/schema").memberships;

  // Before all tests, start the testcontainer Postgres, set the DATABASE_URL, and import the necessary modules after the environment is set up.
  beforeAll(async () => {
    // Fresh DB, real migrations, app_user connection.
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;

    ({ db } = await import("@/lib/db/client"));
    ({ createOrganization } = await import("../actions"));
    ({ withUserContext } = await import("@/lib/db/with-user-context"));
    ({ organizations, memberships } = await import("@/lib/db/schema"));

    // Memberships point at profiles, so the creator must exist first.
    await rls.admin.query(
      "insert into profiles (id, role) values ($1, $2), ($3, $4)",
      [USER_A, "member", USER_B, "member"],
    );
  });

  afterAll(async () => {
    await db?.$client.end();
    await rls?.cleanup();
  });
  // This test verifies that the createOrganization action creates an organization and a membership for the creator, and that the new org is visible to the creator but not to another user due to RLS policies.
  it("creates the org and makes the creator org_admin", async () => {
    fake.getSessionUser.mockResolvedValue({
      userId: USER_A,
      email: "a@example.com",
      roles: [],
    });

    const { id: orgId } = await createOrganization({ name: "Cold Chain" });

    // USER_A should see the org through the new admin membership.
    const aOrgs = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );
    // USER_B should not see the org because they have no membership and RLS should block it.
    const aMemberships = await withUserContext(
      { userId: USER_A, roles: [] },
      (tx) => tx.select().from(memberships),
    );
    // USER_B should see no orgs.
    const bOrgs = await withUserContext({ userId: USER_B, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );

    // USER_B has no membership, so org RLS hides the row.
    expect(aOrgs.map((row) => row.id)).toEqual([orgId]);
    expect(aOrgs.map((row) => row.name)).toEqual(["Cold Chain"]);
    expect(aMemberships).toEqual([
      expect.objectContaining({
        orgId,
        userId: USER_A,
        role: "org_admin",
      }),
    ]);
    expect(bOrgs).toEqual([]);
  });
});
