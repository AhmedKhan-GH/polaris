// This file defines the database schema for organization memberships, which link users to organizations with specific roles (org_admin or org_member).
// It also defines a Row-Level Security (RLS) policy to ensure that users can only read memberships for organizations they belong to.
// This is a critical part of the permissions system, as it enforces that users cannot access membership information for organizations they are not a part of.

import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  timestamp,
  uuid,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { appUser, profiles, organizations } from "@/lib/db/schema";

// Define the possible roles a user can have within an organization.
export const orgRoles = pgEnum("org_roles", ["org_admin", "org_member"]);
export const memberships = pgTable(
  "memberships",
  {
    // Each membership has a unique ID, references an organization and a user, and has a role. The createdAt timestamp tracks when the membership was created.
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    role: orgRoles("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [unique().on(t.orgId, t.userId)],
).enableRLS();
// RLS policy to allow users to read memberships for organizations they belong to.
export const memberRead = pgPolicy("member_read", {
  for: "select",
  to: appUser,
  using: sql`org_id IN (SELECT get_my_org_ids(current_setting('app.user_id', true)::uuid))`,
}).link(memberships);
