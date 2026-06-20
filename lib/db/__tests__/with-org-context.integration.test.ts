import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startRlsTestDb } from "./rls-test-db";

/**
 * withOrgContext integration suite (testcontainer, real Postgres, real RLS).
 *
 * The unit suite (with-org-context.test.ts) mocks withUserContext entirely
 * and only proves the internal call sequence. This suite proves the actual
 * security-critical claim: that app.org_id and app.org_role are genuinely
 * readable by Postgres after withOrgContext runs, that a non-member is
 * rejected before fn ever executes (fail-closed), and that invalid input
 * never reaches the database at all.
 */

const USER_A = "11111111-1111-1111-1111-111111111111"; // member of ORG_A
const USER_C = "33333333-3333-3333-3333-333333333333"; // no memberships at all
const ORG_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("withOrgContext RLS (testcontainer)", (): void => {
    let rls: Awaited<ReturnType<typeof startRlsTestDb>> | undefined;
    let withOrgContext: typeof import("@/lib/db/with-org-context").withOrgContext;
    let db: typeof import("@/lib/db/client").db | undefined;

    beforeAll(async (): Promise<void> => {
        // Start a fresh Postgres with the real migrations applied.
        rls = await startRlsTestDb();

        // Point the app client at the non-superuser app role.
        process.env.DATABASE_URL = rls.appConnUri;

        // Import after DATABASE_URL is set, because the db client reads it on load.
        ({ withOrgContext } = await import("@/lib/db/with-org-context"));
        ({ db } = await import("@/lib/db/client"));

        // Seed profiles for both users — memberships FK requires them. USER_C
        // intentionally gets no membership row at all.
        await rls.admin.query(
            "insert into profiles (id, role) values ($1, $2), ($3, $4)",
            [USER_A, "member", USER_C, "member"],
        );

        // Seed the org and USER_A's org_admin membership.
        await rls.admin.query(
            "insert into organizations (id, name, created_by) values ($1, $2, $3)",
            [ORG_A_ID, "Org A", USER_A],
        );
        await rls.admin.query(
            "insert into memberships (org_id, user_id, role) values ($1, $2, $3)",
            [ORG_A_ID, USER_A, "org_admin"],
        );
    });

    afterAll(async (): Promise<void> => {
        // These are optional because setup may fail before they exist.
        await db?.$client.end();
        await rls?.cleanup();
    });

    it("sets app.org_id and a valid app.org_role for a real member, and runs fn", async (): Promise<void> => {
        let fnRan = false;

        const result = await withOrgContext(
            { userId: USER_A, orgId: ORG_A_ID },
            async (tx) => {
                fnRan = true;

                // Read the GUCs back directly from Postgres — proves they were
                // genuinely set in this transaction, not just that set_config was
                // called with the right-looking arguments against a mock.
                const orgIdResult = await tx.execute(
                    sql`select current_setting('app.org_id', true) as value`,
                );
                const orgRoleResult = await tx.execute(
                    sql`select current_setting('app.org_role', true) as value`,
                );

                return {
                    orgId: (orgIdResult.rows[0] as { value: string }).value,
                    orgRole: (orgRoleResult.rows[0] as { value: string }).value,
                };
            },
        );

        expect(fnRan).toBe(true);
        expect(result.orgId).toBe(ORG_A_ID);
        expect(result.orgRole).toBe("org_admin");
    });

    it("throws 'Not a member' for a user with no membership, and never runs fn", async (): Promise<void> => {
        let fnRan = false;

        await expect(
            withOrgContext({ userId: USER_C, orgId: ORG_A_ID }, async () => {
                fnRan = true;
                return "should not happen";
            }),
        ).rejects.toThrow("Not a member");

        expect(fnRan).toBe(false);
    });

    it("rejects an invalid orgId before touching the database, and never runs fn", async (): Promise<void> => {
        let fnRan = false;

        await expect(
            withOrgContext({ userId: USER_A, orgId: "not-a-uuid" }, async () => {
                fnRan = true;
                return "should not happen";
            }),
        ).rejects.toThrow("orgId must be a UUID");

        expect(fnRan).toBe(false);
    });
});