import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

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

/**
 * Order line items — a child of `orders`, NOT independently owned. Access derives
 * entirely from the parent order (the RLS policies join back to `orders`), so
 * this table has no `created_by`.
 *
 * A line is `(order, product, quantity)` with a `unit_price_cents` SNAPSHOT
 * captured at add time (so a later catalog price change never rewrites a placed
 * order's totals) — one row per product per order (`unique(order_id,
 * product_id)`).
 *
 * `order_id` references the sibling table directly (same feature). `product_id`
 * is a bare uuid here — its cross-feature FK to `products(id)` is declared in the
 * migration (hand-written, like the RLS), so this slice never imports another
 * feature's schema (boundary rule D). That FK is `ON DELETE RESTRICT`: a product
 * in use cannot be hard-deleted — `products.retired` is the soft path.
 */
export const orderLines = pgTable(
  'order_lines',
  {
    id: uuid('id').primaryKey().notNull().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
  },
  (table) => [
    unique('order_lines_order_product_unique').on(table.orderId, table.productId),
    check('order_lines_quantity_positive', sql`${table.quantity} > 0`),
  ],
).enableRLS();
