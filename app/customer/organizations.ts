import { sql } from 'drizzle-orm';
import {pgTable, text, timestamp, uuid} from 'drizzle-orm/pg-core';

// Root tenant table for the IAM work.
// For now, an org belongs to the user who created it.
// The read policy lives in the SQL migration.

// Organizations tables and policies
export const organizations = pgTable('organizations', {
    id: uuid('id')
        .primaryKey()
        .notNull()
        .default(sql`gen_random_uuid()`),
    name: text('name')
        .notNull(),
    createdBy: uuid('created_by')
        .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .default(sql`now()`),
}).enableRLS();