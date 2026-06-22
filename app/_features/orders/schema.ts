import { sql } from 'drizzle-orm';
import { bigint, check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Orders — an OWNED resource with a role overlay (Domain Charter D4). A `member`
 * owns the orders they create; `owner`/`admin` read all. The header carries the
 * lifecycle `status` and a human-readable `order_number`; line items live in a
 * sibling table.
 *
 * Hand-written in the migration (declaring them here would make `db:generate`
 * re-emit and drift): the `orders_order_number_seq` sequence (START 100000) that
 * `order_number` draws from, and the role/ownership RLS policies + grants. The
 * CASL twin is `ordersAbilities`; both layers must pass.
 *
 * `created_by` is a bare uuid with NO FK to auth.users so the table applies
 * cleanly to a vanilla Postgres container. The `status` CHECK enumerates the
 * five lifecycle states; legal TRANSITIONS between them are enforced by the
 * guarded action (VALID_TRANSITIONS), not the column.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().notNull().default(sql`gen_random_uuid()`),
    orderNumber: bigint('order_number', { mode: 'number' })
      .notNull()
      .unique()
      .default(sql`nextval('orders_order_number_seq')`),
    createdBy: uuid('created_by').notNull(),
    status: text('status').notNull().default('draft'),
    statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    check(
      'orders_status_valid',
      sql`${table.status} in ('draft', 'submitted', 'processing', 'completed', 'cancelled')`,
    ),
  ],
).enableRLS();
