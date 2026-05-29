import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  pgEnum,
  pgPolicy,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase/rls";

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

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    email: text("email"),
    role: userRole("role").notNull().default("member"),
    createdAt: epochMs("created_at"),
  },
  (table) => [
    pgPolicy("profiles_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = auth.uid()`,
    }),
    pgPolicy("profiles_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'system')`,
    }),
  ],
);

export const orderStatus = pgEnum("order_status", [
  "draft",
  "confirmed",
  "processing",
  "fulfilled",
  "closed",
  "cancelled",
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
    statusUpdatedAt: epochMs("status_updated_at"),
    duplicatedFromOrderId: uuid("duplicated_from_order_id"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: epochMs("created_at"),
  },
  (table) => [
    index("orders_created_at_id_idx").on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("orders_active_idx")
      .on(table.createdAt.desc(), table.id.desc())
      .where(
        sql`status IN ('draft', 'confirmed', 'processing', 'fulfilled')`,
      ),
    foreignKey({
      columns: [table.duplicatedFromOrderId],
      foreignColumns: [table.id],
      name: "orders_duplicated_from_fk",
    }),

    // SELECT: internal roles see all rows
    pgPolicy("orders_select_internal", {
      for: "select",
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'member', 'system')`,
    }),
    // SELECT: guests see only rows they created
    pgPolicy("orders_select_guest", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        (auth.jwt() ->> 'user_role') = 'guest'
        AND ${table.createdBy} = auth.uid()
      `,
    }),
    // INSERT: must set created_by to self
    pgPolicy("orders_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        (auth.jwt() ->> 'user_role') IN ('guest', 'member', 'admin', 'owner')
        AND ${table.createdBy} = auth.uid()
      `,
    }),
    // UPDATE: owner/admin can update any order
    pgPolicy("orders_update_privileged", {
      for: "update",
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'user_role') IN ('owner', 'admin')`,
    }),
    // UPDATE: member can update only their own orders
    pgPolicy("orders_update_member", {
      for: "update",
      to: authenticatedRole,
      using: sql`
        (auth.jwt() ->> 'user_role') = 'member'
        AND ${table.createdBy} = auth.uid()
      `,
    }),
    // UPDATE: guest can update only their own drafted orders
    pgPolicy("orders_update_guest", {
      for: "update",
      to: authenticatedRole,
      using: sql`
        (auth.jwt() ->> 'user_role') = 'guest'
        AND ${table.createdBy} = auth.uid()
        AND ${table.status} = 'draft'
      `,
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
    changedAt: epochMs("changed_at"),
    reason: text("reason"),
  },
  (table) => [
    index("order_status_history_order_id_idx").on(
      table.orderId,
      table.changedAt,
    ),

    // SELECT: internal roles see all history
    pgPolicy("osh_select_internal", {
      for: "select",
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'member', 'system')`,
    }),
    // SELECT: guests see history for their own orders only
    pgPolicy("osh_select_guest", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        (auth.jwt() ->> 'user_role') = 'guest'
        AND ${table.orderId} IN (
          SELECT id FROM orders WHERE created_by = auth.uid()
        )
      `,
    }),
    // INSERT: roles that can transition or discard
    pgPolicy("osh_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        (auth.jwt() ->> 'user_role') IN ('guest', 'member', 'admin', 'owner')
      `,
    }),
  ],
);

export const orderStatusCounts = pgTable(
  "order_status_counts",
  {
    status: orderStatus("status").notNull(),
    count: bigint("count", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.status] }),

    // Aggregate data, safe for all authenticated users
    pgPolicy("osc_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
