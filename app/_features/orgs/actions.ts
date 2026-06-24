"use server";

import { randomUUID } from "node:crypto";

import { subject } from "@casl/ability";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { memberships, organizations } from "@/lib/db/schema";
import { withOrgContext } from "@/lib/db/with-org-context";
import {
  defineOrgAbilityFor,
  type OrgRole,
} from "@/lib/permissions/org-ability";
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

const addMemberByEmailSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  role: z.enum(["org_admin", "org_member"]),
});

export type AddMemberByEmailInput = z.input<typeof addMemberByEmailSchema>;

export type OrgMemberRow = {
  userId: string;
  email: string | null;
  role: "org_admin" | "org_member";
};

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

// This function allows an org_admin to add an existing user to the organization by their email address.
export async function addMemberByEmail(
  orgId: string,
  input: AddMemberByEmailInput,
): Promise<void> {
  return withPermission("manage", "Membership", (ctx) =>
    withRateLimit(
      orgWriteLimiter,
      `orgs:add-member:${ctx.userId}:${orgId}`,
      async () =>
        withOrgContext({ userId: ctx.userId, orgId }, async (tx) => {
          // Validate after the auth gates so bad attempts still spend budget.
          const { email, role } = addMemberByEmailSchema.parse(input);

          // withOrgContext proves the caller is in this org before this write runs.
          // We read the org_role GUC to determine the caller's role in this org.
          const roleResult = await tx.execute(
            sql`select current_setting('app.org_role', true) as role`,
          );
          const orgRole = roleResult.rows[0]?.role;

          // We define the user's ability based on their role in the organization and check if they have permission to manage memberships.
          const ability = defineOrgAbilityFor(
            typeof orgRole === "string" ? (orgRole as OrgRole) : null,
            ctx.userId,
            orgId,
          );

          // If the user does not have the required permission, we throw an error to prevent unauthorized access.
          if (!ability.can("manage", subject("Membership", { orgId }))) {
            throw new Error("Not authorized");
          }

          // We look up the user ID associated with the provided email address. If no user is found, we throw an error.
          const userResult = await tx.execute(
            sql`select profile_id_for_email(${email}) as user_id`,
          );
          const foundUserId = userResult.rows[0]?.user_id;

          // If the user ID is not found, we throw an error indicating that no user exists for the provided email.
          if (typeof foundUserId !== "string") {
            throw new Error("No user found for that email");
          }

          // Duplicate adds are harmless.
          await tx
            .insert(memberships)
            .values({ orgId, userId: foundUserId, role })
            .onConflictDoNothing({
              target: [memberships.orgId, memberships.userId],
            });
        }),
    ),
  );
}

// This function lists all members of a given organization, returning their user IDs, email addresses, and roles.
// It ensures that the caller has permission to read membership information and is part of the organization.
export async function listOrgMembers(orgId: string): Promise<OrgMemberRow[]> {
  return withPermission("read", "Membership", (ctx) =>
    withOrgContext({ userId: ctx.userId, orgId }, async (tx) => {
      // withOrgContext proves the caller is in this org before this read runs.
      const result = await tx.execute(
        sql`
          select
            memberships.user_id as "userId",
            profiles.email as "email",
            memberships.role as "role"
          from memberships
          inner join profiles on profiles.id = memberships.user_id
          where memberships.org_id = ${orgId}
          order by profiles.email asc nulls last
        `,
      );

      return result.rows.map((row) => ({
        userId: String(row.userId),
        email: row.email === null ? null : String(row.email),
        role: row.role === "org_admin" ? "org_admin" : "org_member",
      }));
    }),
  );
}
