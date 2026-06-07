import {
  pgTable,
  pgRole,
  pgPolicy,
  uuid,
  bigint,
  text,
  boolean,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Restricted runtime role — subject to RLS (no BYPASSRLS, not a table owner).
export const appUser = pgRole('app_user')

export const signInLog = pgTable('sign_in_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  email: text('email').notNull(),
  success: boolean('success').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

// Orders — bare base (UUIDs only; order_number, line items, status come later).
// created_by is the Keycloak sub; used for ownership scoping (CASL + RLS).
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdBy: uuid('created_by').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    // A user sees/acts on their own orders; the `owner` role sees all.
    pgPolicy('orders_owner_or_self', {
      for: 'all',
      to: appUser,
      using: sql`${t.createdBy} = current_setting('app.user_id', true)::uuid
        OR 'owner' = ANY(string_to_array(current_setting('app.user_roles', true), ','))`,
      withCheck: sql`${t.createdBy} = current_setting('app.user_id', true)::uuid`,
    }),
  ],
)
