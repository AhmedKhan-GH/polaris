import { sql } from "drizzle-orm";
import {
  bigint,
  foreignKey,
  index,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Active states are the operational pipeline; the three terminal sinks
// (deleted, cancelled, voided) are forward-only exits enforced by the
// orders_forward_status trigger. Reverts happen by duplicating into a
// new draft, never by walking back. 'archiving' is a holding step
// between invoiced and the terminal 'archived' --- post-fulfillment but
// not yet fully closed out.
export const orderStatus = pgEnum("order_status", [
  "draft",
  "submitted",
  "invoiced",
  "archiving",
  "archived",
  "deleted",
  "cancelled",
  "voided",
]);

export const orderNumberSeq = pgSequence("order_number_seq", {
  startWith: 1000000,
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: bigint("order_number", { mode: "number" })
      .notNull()
      .unique()
      .default(sql`nextval('order_number_seq')`),
    status: orderStatus("status").notNull().default("draft"),
    statusUpdatedAt: timestamp("status_updated_at").notNull().defaultNow(),
    duplicatedFromOrderId: uuid("duplicated_from_order_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
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
    // how big the terminal-state archive grows. 'archiving' is the
    // post-fulfillment holding step and counts as active until it
    // graduates to the terminal 'archived'.
    index("orders_active_idx")
      .on(table.createdAt.desc(), table.id.desc())
      .where(
        sql`status IN ('draft', 'submitted', 'invoiced', 'archiving')`,
      ),
    foreignKey({
      columns: [table.duplicatedFromOrderId],
      foreignColumns: [table.id],
      name: "orders_duplicated_from_fk",
    }),
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
    changedAt: timestamp("changed_at").notNull().defaultNow(),
    reason: text("reason"),
  },
  (table) => [
    index("order_status_history_order_id_idx").on(
      table.orderId,
      table.changedAt,
    ),
  ],
);
