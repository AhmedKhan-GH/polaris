import { sql } from 'drizzle-orm';
import {pgTable, pgPolicy, timestamp, uuid, pgEnum, unique} from 'drizzle-orm/pg-core';
import {appUser, profiles, organizations} from "@/lib/db/schema";

export const orgRoles = pgEnum('org_roles', ['admin', 'member'])

export const memberships = pgTable('memberships', {
    id: uuid('id')
        .primaryKey()
        .notNull()
        .default(sql`gen_random_uuid()`),
    orgId: uuid('org_id')
        .notNull()
        .references(() => organizations.id),
    userId: uuid('user_id')
        .notNull()
        .references(() => profiles.id),
    role: orgRoles('role')
        .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .default(sql`now()`),
}, (t) => [
    unique().on(t.orgId, t.userId)
]).enableRLS();

export const memberRead = pgPolicy('member_read', {
    for: 'select',
    to: appUser,
    using: sql`org_id IN (SELECT get_my_org_ids(current_setting('app.user_id', true)::uuid))`
}).link(memberships)
