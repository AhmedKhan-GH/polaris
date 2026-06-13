import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startRlsTestDb } from "./rls-test-db";

// These two users let us prove org rows do not leak across memberships.
const USER_A   = "11111111-1111-1111-1111-111111111111";
const USER_B   = "22222222-2222-2222-2222-222222222222";
const ORG_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("organizations membership-read RLS (testcontainer)", (): void => {
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

        // Seed profiles first — memberships FK requires them.
        await rls.admin.query(
            "insert into profiles (id, role) values ($1, $2), ($3, $4)",
            [USER_A, "member", USER_B, "member"]
        );

        // Seed orgs with known IDs.
        await rls.admin.query(
            "insert into organizations (id, name, created_by) values ($1, $2, $3), ($4, $5, $6)",
            [ORG_A_ID, "Org A", USER_A, ORG_B_ID, "Org B", USER_B]
        );

        // Seed memberships — each user belongs to their own org only.
        await rls.admin.query(
            "insert into memberships (org_id, user_id, role) values ($1, $2, $3), ($4, $5, $6)",
            [ORG_A_ID, USER_A, "member", ORG_B_ID, USER_B, "member"]
        );
    });

    afterAll(async (): Promise<void> => {
        // These are optional because setup may fail before they exist.
        await db?.$client.end();
        await rls?.cleanup();
    });

    it("shows USER_A their organization via membership", async (): Promise<void> => {
        const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
            tx.select().from(organizations),
        );

        expect(rows.map((r): string => r.name)).toEqual(["Org A"]);
    });

    it("hides USER_B's organization from USER_A", async (): Promise<void> => {
        const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
            tx.select().from(organizations),
        );

        expect(rows).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: "Org B" }),
            ]),
        );
    });
});