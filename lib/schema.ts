import { sql } from "drizzle-orm";
import { bigint, pgSequence, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const orderNumberSeq = pgSequence("order_number_seq", {
  startWith: 1000000,
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: bigint("order_number", { mode: "number" })
    .notNull()
    .unique()
    .default(sql`nextval('order_number_seq')`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Client-minted token echoed back in the realtime INSERT payload so
  // the client can match its own pending placeholder to the incoming
  // row even before the server action returns. Not a primary key ---
  // the row's real identity is still `id`. Nullable because rows
  // seeded or created server-side never need one.
  clientCorrelationId: uuid("client_correlation_id"),
});
