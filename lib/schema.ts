import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgSequence,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
  ],
);
