import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

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

/**
 * Order line items — a child of `orders`, NOT independently owned. Access derives
 * entirely from the parent order (the RLS policy joins back to `orders`), so this
 * table has no `created_by`.
 *
 * Minimal on purpose: a line is `(order, product, quantity)`, one row per product
 * per order (`unique(order_id, product_id)`). Deferred: `unit`, a snapshot
 * `unit_price` (the line currently derives price from the product catalog),
 * `line_number`, and fractional quantities.
 *
 * `order_id` references the sibling table directly (same feature). `product_id`
 * is a bare uuid here — its cross-feature FK to `products(id)` is declared in the
 * migration (hand-written, like the RLS), so this slice never imports another
 * feature's schema (boundary rule D). That FK is `ON DELETE RESTRICT`: a product
 * in use cannot be hard-deleted, which is exactly why `products.retired` exists.
 */
export const orderLineItems = pgTable(
  'order_line_items',
  {
    id: uuid('id')
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (table) => [
    unique('order_line_items_order_product_unique').on(table.orderId, table.productId),
    check('order_line_items_quantity_positive', sql`${table.quantity} > 0`),
  ],
).enableRLS();
