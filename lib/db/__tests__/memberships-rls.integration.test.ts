import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startRlsTestDb } from "./rls-test-db";

const USER_A   = "11111111-1111-1111-1111-111111111111";
const USER_B   = "22222222-2222-2222-2222-222222222222";
const USER_C   = "33333333-3333-3333-3333-333333333333";
const ORG_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";


describe("Memberships RLS test and duplicate check", (): void => {
    let rls: Awaited<ReturnType<typeof startRlsTestDb>> | undefined;
    let withUserContext: typeof import("@/lib/db/with-user-context").withUserContext;
    let db: typeof import("@/lib/db/client").db | undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let organizations: typeof import("@/lib/db/schema").organizations;
    let memberships: typeof import("@/lib/db/schema").memberships;

    beforeAll(async (): Promise<void> => {
        // Start a fresh Postgres with the real migrations applied.
        rls = await startRlsTestDb();

        // Point the app client at the non-superuser app role.
        process.env.DATABASE_URL = rls.appConnUri;

        // Import after DATABASE_URL is set, because the db client reads it on load.
        ({ withUserContext } = await import("@/lib/db/with-user-context"));
        ({ db } = await import("@/lib/db/client"));

        // Use the schema root so this test follows the repo boundary rules.
        ({ organizations, memberships } = await import("@/lib/db/schema"));

        // Seed as admin. The actual reads below go through RLS.
        await rls.admin.query("insert into organizations (id, name, created_by) values ($1, $2, $3), ($4, $5, $6)",
            [ORG_A_ID, "Org A", USER_A, ORG_B_ID, "Org B", USER_B]
        );
        // Need profile to link Users
        await rls.admin.query(
            "insert into profiles (id, role) values ($1, $2), ($3, $4)",
            [USER_A, "member", USER_B, "member"]
        );
        await rls.admin.query("insert into memberships (org_id, user_id, role) values ($1, $2, $3), ($4, $5, $6)",
            [ORG_A_ID, USER_A, "member", ORG_B_ID, USER_B, "member"]);
    })

    afterAll(async (): Promise<void> => {
        // These are optional because setup may fail before they exist.
        await db?.$client.end();
        await rls?.cleanup();
    });

    it("User A can see their own membership in Org A", async (): Promise<void> => {
        const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
            tx.select().from(memberships),  // just swap the table
        );
        // User A should see their own org and membership in that org
        expect(rows.map((r) => r.orgId)).toEqual([ORG_A_ID]);
    })

    it("User A cannot see User B's membership in Org B", async (): Promise<void> => {
        const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
            tx.select().from(memberships),  // just swap the table
        );
        // User A should not see User B's org
        expect(rows).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ orgId: ORG_B_ID })
            ])
        );
    })

    it("User C, with no membership, cannot see any Org", async (): Promise<void> => {
        const rows = await withUserContext({ userId: USER_C, roles: [] }, (tx) =>
            tx.select().from(memberships),  // just swap the table
        );
        // User C should not see anything at all
        expect(rows).toEqual([]);
    })

})
