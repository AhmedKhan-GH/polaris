// Integration tests for the org actions.
// They mock only the session; DB migrations and RLS stay real.
// Covers createOrganization, addMemberByEmail, and listOrgMembers.
// Command: `npm run test:integration -- app/_features/orgs/__tests__/create-organization.integration.test.ts`

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { startRlsTestDb } from "@/lib/db/__tests__/rls-test-db";

// Fake users for testing. These are not real users, but they must exist in the test DB.
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const USER_C = "33333333-3333-3333-3333-333333333333";

// Mock the session user for testing. The tests will set this to different users as needed.
const fake = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: fake.getSessionUser,
}));

// The tests below are integration tests that use a real database with RLS enabled.
// They test the org actions in a realistic environment, ensuring that the actions behave correctly with respect to user roles and permissions.
describe("org actions integration", () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>> | undefined;
  let db: typeof import("@/lib/db/client").db | undefined;
  let addMemberByEmail: typeof import("../actions").addMemberByEmail;
  let createOrganization: typeof import("../actions").createOrganization;
  let listOrgMembers: typeof import("../actions").listOrgMembers;
  let withUserContext: typeof import("@/lib/db/with-user-context").withUserContext;
  let organizations: typeof import("@/lib/db/schema").organizations;
  let memberships: typeof import("@/lib/db/schema").memberships;

  // Before all tests, start the RLS test database and set up the environment.
  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;

    ({ db } = await import("@/lib/db/client"));
    ({ addMemberByEmail, createOrganization, listOrgMembers } =
      await import("../actions"));
    ({ withUserContext } = await import("@/lib/db/with-user-context"));
    ({ organizations, memberships } = await import("@/lib/db/schema"));

    // Memberships point at profiles, so test users must exist first.
    await rls.admin.query(
      "insert into profiles (id, email, role) values ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)",
      [
        USER_A,
        "a@example.com", // role is "member" because the org role is separate
        "member",
        USER_B,
        "b@example.com",
        "member",
        USER_C,
        "c@example.com",
        "member",
      ],
    );
  });

  afterAll(async () => {
    await db?.$client.end();
    await rls?.cleanup();
  });

  // Test that creating an organization works and that the creator is assigned the org_admin role.
  it("creates the org and makes the creator org_admin", async () => {
    fake.getSessionUser.mockResolvedValue({
      userId: USER_A,
      email: "a@example.com",
      roles: [],
    });

    // Create an organization and check that the creator is assigned the org_admin role.
    const { id: orgId } = await createOrganization({ name: "Cold Chain" });

    // Check that the organization was created and that the creator has the correct role.
    const aOrgs = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );
    // Check that the memberships table has the correct entry for the creator.
    const aMemberships = await withUserContext(
      { userId: USER_A, roles: [] },
      (tx) => tx.select().from(memberships),
    );
    // Check that another user (USER_B) does not see the organization since they are not a member.
    const bOrgs = await withUserContext({ userId: USER_B, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );

    // Assertions to verify the expected outcomes.
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

  // Test that an org_admin can add a member, but an org_member cannot.
  it("lets an org_admin add a member, but denies an org_member", async () => {
    fake.getSessionUser.mockResolvedValue({
      userId: USER_A,
      email: "a@example.com",
      roles: [],
    });
    // Create an organization and add USER_B as a member.
    const { id: orgId } = await createOrganization({ name: "Frozen Goods" });
    // Add USER_B as a member of the organization.
    await addMemberByEmail(orgId, {
      email: "b@example.com",
      role: "org_member",
    });
    // Check that USER_B can see the organization after being added.
    const bOrgs = await withUserContext({ userId: USER_B, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );
    expect(bOrgs.map((row) => row.id)).toEqual([orgId]);

    // Now, check that USER_B (an org_member) cannot add another member (USER_C).
    fake.getSessionUser.mockResolvedValue({
      userId: USER_B,
      email: "b@example.com",
      roles: [],
    });

    // Attempt to add USER_C as a member of the organization, which should fail due to insufficient permissions.
    await expect(
      addMemberByEmail(orgId, {
        email: "c@example.com",
        role: "org_member",
      }),
    ).rejects.toThrow("Not authorized");

    const cOrgs = await withUserContext({ userId: USER_C, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );
    expect(cOrgs).toEqual([]);
  });

  // Test that listing org members returns the correct members and their roles.
  it("lists exactly the current org members", async () => {
    fake.getSessionUser.mockResolvedValue({
      userId: USER_A,
      email: "a@example.com",
      roles: [],
    });
    // Create an organization and add USER_B as a member.
    const { id: orgId } = await createOrganization({ name: "Produce" });

    await addMemberByEmail(orgId, {
      email: "b@example.com",
      role: "org_member",
    });

    // List the members of the organization and check that the correct members are returned.
    const rows = await listOrgMembers(orgId);

    expect(rows).toEqual([
      { userId: USER_A, email: "a@example.com", role: "org_admin" },
      { userId: USER_B, email: "b@example.com", role: "org_member" },
    ]);
  });
});
