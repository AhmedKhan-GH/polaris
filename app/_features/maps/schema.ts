import { sql } from "drizzle-orm";
import {
  doublePrecision,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations } from "@/lib/db/schema";

// Address pins belong to one org and become the shared base for maps/routes.
// Command: `npx drizzle-kit generate --name=addresses_org_rls`
export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().notNull().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  label: text("label").notNull(),
  rawAddress: text("raw_address").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();
