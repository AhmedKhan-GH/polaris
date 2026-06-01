import { pgTable, uuid, bigint } from 'drizzle-orm/pg-core'

export const signInLog = pgTable('sign_in_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})
