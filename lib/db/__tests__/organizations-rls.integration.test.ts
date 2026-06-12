import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startRlsTestDb } from "./rls-test-db";

// These two users let us prove org rows do not leak across creators.
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";


describe("organizations creator-read RLS (testcontainer)", (): void => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>> | undefined;
  let withUserContext: typeof import("@/lib/db/with-user-context").withUserContext;
  let db: typeof import("@/lib/db/client").db | undefined;
  let organizations: typeof import("@/lib/db/schema").organizations;

  beforeAll(async (): Promise<void> => {
    // Start a fresh Postgres with the real migrations applied.
    rls = await startRlsTestDb();

    // Point the app client at the non-superuser app role.
    process.env.DATABASE_URL = rls.appConnUri;

    // Import after DATABASE_URL is set, because the db client reads it on load.
    ({ withUserContext } = await import("@/lib/db/with-user-context"));
    ({ db } = await import("@/lib/db/client"));

    // Use the schema root so this test follows the repo boundary rules.
    ({ organizations } = await import("@/lib/db/schema"));

    // Seed as admin. The actual reads below go through RLS.
    await rls.admin.query(
      "insert into organizations (name, created_by) values ($1, $2), ($3, $4)",
      ["Org A", USER_A, "Org B", USER_B],
    );
  });

  afterAll(async (): Promise<void> => {
    // These are optional because setup may fail before they exist.
    await db?.$client.end();
    await rls?.cleanup();
  });

  it("shows USER_A their organization but not USER_B's", async (): Promise<void> => {
    // USER_A should only see the row they created.
    const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );

    expect(rows.map((r): string => r.name)).toEqual(["Org A"]);
    expect(rows.map((r): string => r.createdBy)).toEqual([USER_A]);
  });

  it("hides USER_A's organization from USER_B", async (): Promise<void> => {
    // USER_B should not see USER_A's org.
    const rows = await withUserContext({ userId: USER_B, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );
    // USER_B should only see the row they created.
    expect(rows.map((r): string => r.name)).toEqual(["Org B"]);
    expect(rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Org A", createdBy: USER_A }),
      ]),
    );
  });
});
