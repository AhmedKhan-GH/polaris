// Integration test for the addresses table RLS policy.
// It uses real migrations and the real app_user role.
// Command: `npm run test:integration -- lib/db/__tests__/addresses-rls.integration.test.ts`

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startRlsTestDb } from "./rls-test-db";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const ORG_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ADDRESS_A_ID = "aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa";
const ADDRESS_B_ID = "bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb";

describe("addresses org-scoped RLS (testcontainer)", (): void => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>> | undefined;
  let db: typeof import("@/lib/db/client").db | undefined;
  let withOrgContext: typeof import("@/lib/db/with-org-context").withOrgContext;
  let addresses: typeof import("@/lib/db/schema").addresses;

  beforeAll(async (): Promise<void> => {
    // Start a fresh database with the real migrations applied.
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;

    // Import after DATABASE_URL is set so the app client uses app_user.
    ({ db } = await import("@/lib/db/client"));
    ({ withOrgContext } = await import("@/lib/db/with-org-context"));
    ({ addresses } = await import("@/lib/db/schema"));

    // Seed tenant basics as admin; the reads below go through app_user.
    await rls.admin.query(
      "insert into profiles (id, role) values ($1, $2), ($3, $4)",
      [USER_A, "member", USER_B, "member"],
    );

    await rls.admin.query(
      "insert into organizations (id, name, created_by) values ($1, $2, $3), ($4, $5, $6)",
      [ORG_A_ID, "Org A", USER_A, ORG_B_ID, "Org B", USER_B],
    );

    await rls.admin.query(
      "insert into memberships (org_id, user_id, role) values ($1, $2, $3), ($4, $5, $6)",
      [ORG_A_ID, USER_A, "org_admin", ORG_B_ID, USER_B, "org_admin"],
    );

    await rls.admin.query(
      `insert into addresses
        (id, org_id, label, raw_address, lat, lng, created_by)
       values
        ($1, $2, $3, $4, $5, $6, $7),
        ($8, $9, $10, $11, $12, $13, $14)`,
      [
        ADDRESS_A_ID,
        ORG_A_ID,
        "Org A Warehouse",
        "100 A Street",
        41.1,
        -87.1,
        USER_A,
        ADDRESS_B_ID,
        ORG_B_ID,
        "Org B Warehouse",
        "200 B Street",
        42.2,
        -88.2,
        USER_B,
      ],
    );
  });

  afterAll(async (): Promise<void> => {
    // Setup can fail before these exist, so keep cleanup defensive.
    await db?.$client.end();
    await rls?.cleanup();
  });

  it("shows only the active org address", async (): Promise<void> => {
    const rows = await withOrgContext(
      { userId: USER_A, orgId: ORG_A_ID },
      (tx) => tx.select().from(addresses),
    );

    expect(rows.map((row) => row.id)).toEqual([ADDRESS_A_ID]);
    expect(rows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ADDRESS_B_ID })]),
    );
  });
});
