"use server";

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { memberships, organizations } from "@/lib/db/schema";
import { withPermission } from "@/lib/permissions/guard";
import { createRateLimiter, withRateLimit } from "@/lib/rate-limit";

const orgWriteLimiter = createRateLimiter({ points: 10, duration: 60 });

// Keep the action boundary strict. Empty names never reach the DB.
// Organization names are required, but we trim them to prevent names that are just spaces.
// We also set a reasonable max length to prevent abuse and UI issues.
const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(120, "Organization name too long"),
});
// The input type for creating an organization is derived from the Zod schema, ensuring that the function receives validated and correctly typed data.
export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;


// This function creates a new organization and assigns the creating user as an org_admin.
// It uses a transaction to ensure that both the organization and membership are created together, and it applies rate limiting and permission checks to prevent abuse.
export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<{ id: string }> {
  return withPermission("create", "Organization", (ctx) =>
    withRateLimit(orgWriteLimiter, `orgs:create:${ctx.userId}`, async () => {
      // Validate inside the limiter so bad spam still spends budget.
      const { name } = createOrganizationSchema.parse(input);
      const orgId = randomUUID();

      await db.transaction(async (tx): Promise<void> => {
        // The insert policies read these GUCs.
        await tx.execute(
          sql`select set_config('app.user_id', ${ctx.userId}, true)`,
        );
        await tx.execute(
          sql`select set_config('app.user_roles', ${JSON.stringify(ctx.roles)}, true)`,
        );

        // One transaction keeps the org and first admin together.
        await tx.insert(organizations).values({
          id: orgId,
          name,
          createdBy: ctx.userId,
        });
        // The creating user is the first admin of the new org.
        await tx.insert(memberships).values({
          orgId,
          userId: ctx.userId,
          role: "org_admin",
        });
      });

      return { id: orgId };
    }),
  );
}
