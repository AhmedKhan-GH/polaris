import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Timestamps are stored as bigint epoch milliseconds (UTC). This is
// timezone-unambiguous and survives forever without DST/zone migrations
// --- a logistics order written in 2026 means the same instant when read
// from any process in any timezone in 2050. Display layer converts to
// the user's chosen zone at render time.
const epochMs = (name: string) =>
  bigint(name, { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`);

export const userRole = pgEnum("user_role", [
  "system",
  "owner",
  "admin",
  "member",
  "guest",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  role: userRole("role").notNull().default("member"),
  createdAt: epochMs("created_at"),
});

// Active states are the operational pipeline; the three terminal sinks
// (discarded, rejected, voided) are forward-only exits enforced by the
// orders_forward_status trigger. Reverts happen by duplicating into a
// new draft, never by walking back. 'closed' is a holding step
// between invoiced and the terminal 'archived' --- post-fulfillment but
// not yet filed away. 'discarded' is a draft thrown away by its
// author (soft delete kept for audit); a true 'deleted' admin operation
// would be a separate, harder action layered on top later. 'rejected'
// is a submitted order that won't be fulfilled.
export const orderStatus = pgEnum("order_status", [
  "drafted",
  "submitted",
  "invoiced",
  "closed",
  "archived",
  "discarded",
  "rejected",
  "voided",
]);

export const orderNumberSeq = pgSequence("order_number_seq", {
  startWith: 1000000,
});

export const skus = pgTable(
  "skus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skuNumber: text("sku_number").notNull().unique(),
    quickbooksLegacySku: text("quickbooks_legacy_sku"),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    storageType: text("storage_type"),
    defaultUnit: text("default_unit"),
    packSize: text("pack_size"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: epochMs("created_at"),
    updatedAt: epochMs("updated_at"),
  },
  (table) => [
    index("skus_name_idx").on(table.name),
    index("skus_category_idx").on(table.category),
    check("skus_sku_number_not_blank", sql`length(btrim(${table.skuNumber})) > 0`),
    check("skus_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: bigint("order_number", { mode: "number" })
      .notNull()
      .unique()
      .default(sql`nextval('order_number_seq')`),
    status: orderStatus("status").notNull().default("drafted"),
    statusUpdatedAt: epochMs("status_updated_at"),
    duplicatedFromOrderId: uuid("duplicated_from_order_id"),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: epochMs("created_at"),
  },
  (table) => [
    // Cursor-paginated newest-first reads. The (created_at, id) tuple
    // matches the WHERE clause in findOrdersPage and the matching
    // ORDER BY direction, so Postgres serves both filtering and
    // sorting from one index walk.
    index("orders_created_at_id_idx").on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
    // Operational view: only active rows, kept compact regardless of
    // how big the terminal-state archive grows. 'closed' is the
    // post-fulfillment holding step and counts as active until it
    // graduates to the terminal 'archived'.
    index("orders_active_idx")
      .on(table.createdAt.desc(), table.id.desc())
      .where(
        sql`status IN ('drafted', 'submitted', 'invoiced', 'closed')`,
      ),
    foreignKey({
      columns: [table.duplicatedFromOrderId],
      foreignColumns: [table.id],
      name: "orders_duplicated_from_fk",
    }),
  ],
);

export const orderLineItems = pgTable(
  "order_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => skus.id),
    lineNumber: integer("line_number").notNull().default(1),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit: text("unit").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
    notes: text("notes"),
    createdAt: epochMs("created_at"),
    updatedAt: epochMs("updated_at"),
  },
  (table) => [
    unique("order_line_items_order_line_unique").on(
      table.orderId,
      table.lineNumber,
    ),
    index("order_line_items_order_id_idx").on(table.orderId),
    index("order_line_items_sku_id_idx").on(table.skuId),
    index("order_line_items_order_line_idx").on(
      table.orderId,
      table.lineNumber,
    ),
    check("order_line_items_line_number_positive", sql`${table.lineNumber} > 0`),
    check("order_line_items_quantity_positive", sql`${table.quantity} > 0`),
    check("order_line_items_unit_not_blank", sql`length(btrim(${table.unit})) > 0`),
    check(
      "order_line_items_unit_price_non_negative",
      sql`${table.unitPrice} IS NULL OR ${table.unitPrice} >= 0`,
    ),
  ],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    changedBy: uuid("changed_by"),
    changedAt: epochMs("changed_at"),
    reason: text("reason"),
  },
  (table) => [
    index("order_status_history_order_id_idx").on(
      table.orderId,
      table.changedAt,
    ),
  ],
);

// Trigger-maintained counter table: one row per status, holding the
// live count. Reads are O(1) lookups against eight rows; writes happen
// inside an AFTER trigger on `orders` so the kanban column counts stay
// honest without anyone running a GROUP BY scan on every refresh. The
// table is also part of the supabase_realtime publication so deltas
// stream straight into the browser instead of being polled.
export const orderStatusCounts = pgTable(
  "order_status_counts",
  {
    status: orderStatus("status").notNull(),
    count: bigint("count", { mode: "number" }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.status] })],
);
