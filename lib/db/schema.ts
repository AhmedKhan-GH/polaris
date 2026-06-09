import {
  pgTable,
  pgRole,
  pgPolicy,
  uuid,
  timestamp,
  text,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  authenticatedRole,
  realtimeMessages,
  authUid,
  realtimeTopic,
} from 'drizzle-orm/supabase'

// Restricted runtime role — subject to RLS (no BYPASSRLS, not a table owner).
export const appUser = pgRole('app_user')

// App-side identity layered on Supabase auth.users. id = auth.users.id.
// Source of the app role for CASL + withUserContext. org_id arrives at F12.
// Read via the Supabase authenticated client (auth.uid()), NOT the app_user
// Drizzle path — so these policies target `authenticated`, not `app_user`.
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    email: text('email'),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Self-read only. getSessionUser reads the caller's own row; the realtime
    // owner-firehose check (F7) also reads the owner's OWN row, so this suffices.
    // An owner-reads-all-profiles policy would self-reference profiles (infinite
    // RLS recursion) and isn't needed until F9 user management — add it then via
    // a SECURITY DEFINER helper or a JWT role claim.
    pgPolicy('profiles_select_self', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${t.id} = auth.uid()`,
    }),
  ],
)

// A record of *successful* logins (the only auth event the app sees — failed
// logins happen in Supabase Auth/GoTrue and never reach the app).
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
    // (USING). Inserts stay unrestricted (WITH CHECK true) so signInAction can
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
// created_by is the Supabase auth user id; used for ownership scoping (CASL + RLS).
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

// Channel authorization for the live order feed. Subscription auth runs with the
// subscriber's JWT loaded, so authUid (auth.uid()) is reliable here — unlike the
// Postgres-Changes row authorizer (drizzle/0021 scar). A member may read only
// their own topic; an owner additionally reads the firehose. Linked to Supabase's
// realtime.messages (not one of our tables) via .link().
export const ordersReadOwnTopic = pgPolicy('orders_read_own_topic', {
  for: 'select',
  to: authenticatedRole,
  using: sql`${realtimeTopic} = 'orders:' || ${authUid}::text
    OR (
      ${realtimeTopic} = 'orders:all'
      AND EXISTS (SELECT 1 FROM ${profiles} WHERE ${profiles.id} = ${authUid} AND ${profiles.role} = 'owner')
    )`,
}).link(realtimeMessages)
