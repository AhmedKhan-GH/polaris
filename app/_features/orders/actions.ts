'use server';

import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { withUserContext } from '@/lib/db/with-user-context';
import { withPermission } from '@/lib/permissions/guard';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limit';

import { orderLineItems, orders } from './schema';

/**
 * Write budget for orders, OWNED by this feature (Charter D6). 30 writes / 60s
 * per acting user.
 */
const ordersWriteLimiter = createRateLimiter({ points: 30, duration: 60 });

const idField = z.string().uuid('Invalid order id');
const quantityField = z.coerce
  .number()
  .int('Quantity must be a positive whole number')
  .positive('Quantity must be a positive whole number');

export type OrderRow = {
  id: string;
  createdBy: string;
  createdAt: Date;
};

/**
 * Create an empty order owned by the acting user, returning its id so the caller
 * can navigate to it and add line items. Pipeline: guard → limiter → context,
 * then revalidate only on success. `created_by` is set from the guard's identity;
 * the RLS WITH CHECK independently forbids forging another owner.
 */
export async function createOrder(): Promise<string> {
  const id = await withPermission('create', 'Order', (ctx) =>
    withRateLimit(ordersWriteLimiter, `orders:create:${ctx.userId}`, () =>
      withUserContext(ctx, async (tx) => {
        const [row] = await tx
          .insert(orders)
          .values({ createdBy: ctx.userId })
          .returning({ id: orders.id });
        return row.id;
      }),
    ),
  );

  revalidatePath('/orders');
  return id;
}

/**
 * Read the caller's visible orders, newest first. Guarded by CASL (`read Order`)
 * and scoped by RLS: a rep sees only their own, an owner sees all.
 */
export async function getOrders(): Promise<OrderRow[]> {
  return withPermission('read', 'Order', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx.select().from(orders).orderBy(desc(orders.createdAt)),
    ),
  );
}

/**
 * Read a single order by id, or `undefined` if it is not visible to the caller
 * (RLS returns no row). Guarded by `read Order`; the id is validated as a uuid
 * before the query.
 */
export async function getOrder(id: string): Promise<OrderRow | undefined> {
  const orderId = idField.parse(id);
  return withPermission('read', 'Order', (ctx) =>
    withUserContext(ctx, async (tx) => {
      const rows = await tx.select().from(orders).where(eq(orders.id, orderId));
      return rows[0];
    }),
  );
}

export type LineItemRow = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
};

/**
 * Read one order's line items (RLS-scoped: returns rows only when the parent
 * order is visible to the caller). The page joins these to the product catalog
 * (via the products dev-API) for display — orders never imports products' schema.
 */
export async function getOrderLineItems(orderId: string): Promise<LineItemRow[]> {
  const id = idField.parse(orderId);
  return withPermission('read', 'Order', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx.select().from(orderLineItems).where(eq(orderLineItems.orderId, id)),
    ),
  );
}

// --- line-item intake ------------------------------------------------------
//
// All three writes guard `update Order` (editing a line edits the order). That
// CASL check is COARSE — it confirms the caller may edit orders at all; the
// ROW-level "is this YOUR order" gate is the line-item RLS (its WITH CHECK
// requires the parent order be the caller's own), so an owner's read-all never
// becomes write-all here. Both layers must pass.

const addLineSchema = z.object({
  orderId: idField,
  productId: z.string().uuid('Invalid product id'),
  quantity: quantityField,
});

/** Add a product line to an order (one row per product — a duplicate trips the
 *  unique constraint). */
export async function addLineItem(formData: FormData): Promise<void> {
  const { orderId } = await withPermission('update', 'Order', (ctx) =>
    withRateLimit(ordersWriteLimiter, `orders:line:add:${ctx.userId}`, async () => {
      const values = addLineSchema.parse({
        orderId: String(formData.get('orderId') ?? ''),
        productId: String(formData.get('productId') ?? ''),
        quantity: String(formData.get('quantity') ?? ''),
      });
      await withUserContext(ctx, (tx) => tx.insert(orderLineItems).values(values));
      return values;
    }),
  );

  revalidatePath(`/orders/${orderId}`);
}

/** Change a line's quantity. */
export async function updateLineItem(formData: FormData): Promise<void> {
  const orderId = await withPermission('update', 'Order', (ctx) =>
    withRateLimit(ordersWriteLimiter, `orders:line:update:${ctx.userId}`, async () => {
      const id = idField.parse(String(formData.get('id') ?? ''));
      const order = idField.parse(String(formData.get('orderId') ?? ''));
      const quantity = quantityField.parse(String(formData.get('quantity') ?? ''));
      await withUserContext(ctx, (tx) =>
        tx.update(orderLineItems).set({ quantity }).where(eq(orderLineItems.id, id)),
      );
      return order;
    }),
  );

  revalidatePath(`/orders/${orderId}`);
}

/** Remove a line from an order. */
export async function removeLineItem(formData: FormData): Promise<void> {
  const orderId = await withPermission('update', 'Order', (ctx) =>
    withRateLimit(ordersWriteLimiter, `orders:line:remove:${ctx.userId}`, async () => {
      const id = idField.parse(String(formData.get('id') ?? ''));
      const order = idField.parse(String(formData.get('orderId') ?? ''));
      await withUserContext(ctx, (tx) =>
        tx.delete(orderLineItems).where(eq(orderLineItems.id, id)),
      );
      return order;
    }),
  );

  revalidatePath(`/orders/${orderId}`);
}
