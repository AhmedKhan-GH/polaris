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
 * Orders — an OWNED resource with a role overlay (Domain Charter D4). READ is
 * OPEN for now: every signed-in caller sees all orders (and their lines), a
 * deliberate temporary stance. WRITES stay owned — a `member` writes only the
 * orders they create; `owner`/`admin` write all. The header carries the
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
 * A line is `(order, line_number, product, quantity)` with a `list_price_cents`
 * SNAPSHOT captured at add time (so a later catalog price change never rewrites a
 * placed order's totals) and an optional `override_price_cents` — a deliberate
 * per-line price the user typed, stored ALONGSIDE the snapshot (never overwriting
 * it) so off-list pricing stays auditable. The effective price billed is the
 * override when set, else the list snapshot (see `pricing.ts`). The SAME product
 * MAY appear on multiple lines (e.g. at different negotiated prices); lines are
 * ordered and identified within an order by `line_number`
 * (`unique(order_id, line_number)`), assigned by the action.
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
    lineNumber: integer('line_number').notNull(),
    productId: uuid('product_id').notNull(),
    quantity: integer('quantity').notNull(),
    listPriceCents: integer('list_price_cents').notNull(),
    overridePriceCents: integer('override_price_cents'),
  },
  (table) => [
    unique('order_lines_order_line_unique').on(table.orderId, table.lineNumber),
    check('order_lines_quantity_positive', sql`${table.quantity} > 0`),
    check('order_lines_line_number_positive', sql`${table.lineNumber} > 0`),
    check(
      'order_lines_override_price_nonneg',
      sql`${table.overridePriceCents} is null or ${table.overridePriceCents} >= 0`,
    ),
  ],
).enableRLS();
