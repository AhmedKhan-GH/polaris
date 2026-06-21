import { sql } from 'drizzle-orm';
import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Orders — an OWNED resource (instance-level, Domain Charter D4): a rep owns the
 * orders they record, an owner reads all. Ownership RLS lives hand-written in the
 * migration (created_by = app.user_id OR owner role), the CASL twin in
 * `ordersAbilities`; both must pass.
 *
 * Deliberately a bare CONTAINER for now: id + creator + created_at, nothing more.
 * NO status column — the lifecycle state machine is unsettled and an order does
 * not need a status to hold line items; status arrives in its own slice once the
 * model is decided against real orders. Also deferred: order_number, the
 * customer link (F12). `created_by` is a bare uuid with NO FK to auth.users so
 * the table applies cleanly to a vanilla Postgres container.
 */
export const orders = pgTable('orders', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();
