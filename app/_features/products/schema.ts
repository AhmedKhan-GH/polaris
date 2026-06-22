import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Products — a FLAT reference catalog (Domain Charter D4). A product belongs to
 * the catalog, not a user: there is no `created_by` and no per-row ownership.
 * Visibility is UNCONDITIONAL for every signed-in caller (members need the
 * line-item picker); writes are owner-only. Both facts are enforced by the
 * hand-written RLS in the migration — role-based (`app.user_roles`), NOT
 * identity-based — and mirrored in CASL by `productsAbilities`.
 *
 * RLS is enabled here so it travels with the schema; the POLICY and GRANT live
 * UNGUARDED in drizzle/0005_*.sql (declaring them here would make `db:generate`
 * re-emit and drift from them), targeting `app_user` and the `app.user_roles`
 * GUC — both of which exist on the vanilla test container and the live stack.
 *
 * `retired` is a SOFT state, never a hard delete from the picker's view: order
 * line items will reference products, so a product is retired (hidden) rather
 * than removed. `price_cents` is an integer (cents), never a float. `sku` is the
 * unique stock key.
 */
export const products = pgTable('products', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  priceCents: integer('price_cents').notNull(),
  retired: boolean('retired').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();
