import {
  pgTable,
  pgRole,
  pgPolicy,
  uuid,
  timestamp,
  text,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Restricted runtime role — subject to RLS (no BYPASSRLS, not a table owner).
export const appUser = pgRole('app_user')

// A record of *successful* logins (the only auth event the app sees — failures
// happen at Keycloak and never reach it; review those in Keycloak's console).
export const signInLog = pgTable(
  'sign_in_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id'),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  () => [
    // Global admin log (no per-row owner): only the `owner` role may read
    // (USING). Inserts stay unrestricted (WITH CHECK true) so recordSignIn can
    // log every sign-in — it runs as app_user with no user session/GUC.
    pgPolicy('sign_in_log_owner_read', {
      for: 'all',
      to: appUser,
      using: sql`coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)`,
      withCheck: sql`true`,
    }),
  ],
)

// Orders — bare base (UUIDs only; order_number, line items, status come later).
// created_by is the Keycloak sub; used for ownership scoping (CASL + RLS).
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // A user sees/acts on their own orders; the `owner` role sees all.
    pgPolicy('orders_owner_or_self', {
      for: 'all',
      to: appUser,
      using: sql`${t.createdBy} = current_setting('app.user_id', true)::uuid
        OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)`,
      withCheck: sql`${t.createdBy} = current_setting('app.user_id', true)::uuid`,
    }),
  ],
)
