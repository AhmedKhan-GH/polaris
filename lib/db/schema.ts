import { pgTable, uuid, bigint, text, boolean } from 'drizzle-orm/pg-core'

export const signInLog = pgTable('sign_in_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  email: text('email').notNull(),
  success: boolean('success').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

// Orders — bare base (UUIDs only; order_number, line items, status come later).
// created_by is the Keycloak sub; used for ownership scoping (CASL + RLS).
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdBy: uuid('created_by').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})
