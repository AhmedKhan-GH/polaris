'use server';

import { desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { withUserContext } from '@/lib/db/with-user-context';
import { withPermission } from '@/lib/permissions/guard';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limit';

import { orderLines, orders } from './schema';
import { canTransition, ORDER_STATUSES, type OrderStatus } from './transitions';

/** Write budget for orders, OWNED by this feature (Charter D6): 30 writes / 60s
 *  per acting user, shared across create / line edits / transitions. */
const ordersWriteLimiter = createRateLimiter({ points: 30, duration: 60 });

const idField = z.string().uuid('Invalid order id');
const quantityField = z.coerce
  .number()
  .int('Quantity must be a positive whole number')
  .positive('Quantity must be a positive whole number');
const overridePriceField = z.coerce
  .number()
  .int('Invalid price')
  .nonnegative('Invalid price');

export type OrderRow = {
  id: string;
  orderNumber: number;
  createdBy: string;
  status: string;
  statusUpdatedAt: Date;
  createdAt: Date;
};

export type LineRow = {
  id: string;
  orderId: string;
  lineNumber: number;
  productId: string;
  quantity: number;
  listPriceCents: number;
  overridePriceCents: number | null;
};

/**
 * Create an empty draft order owned by the acting user, returning its id so the
 * caller can open it and add lines. `created_by` is set from the guard's
 * identity; the RLS WITH CHECK independently forbids forging another owner.
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

/** The caller's visible orders, newest first (RLS-scoped: a member sees their
 *  own, owner/admin see all). */
export async function getOrders(): Promise<OrderRow[]> {
  return withPermission('read', 'Order', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx.select().from(orders).orderBy(desc(orders.createdAt)),
    ),
  );
}

/** A single order by id, or `undefined` if not visible to the caller (RLS). */
export async function getOrder(id: string): Promise<OrderRow | undefined> {
  const orderId = idField.parse(id);
  return withPermission('read', 'Order', (ctx) =>
    withUserContext(ctx, async (tx) => {
      const rows = await tx.select().from(orders).where(eq(orders.id, orderId));
      return rows[0];
    }),
  );
}

/** One order's line items (RLS-scoped via the parent order). */
export async function getOrderLines(orderId: string): Promise<LineRow[]> {
  const id = idField.parse(orderId);
  return withPermission('read', 'Order', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx
        .select()
        .from(orderLines)
        .where(eq(orderLines.orderId, id))
        .orderBy(orderLines.lineNumber),
    ),
  );
}

// --- line-item intake -------------------------------------------------------
// All three writes guard `update Order` (editing a line edits the order). That
// CASL check is COARSE; the row-level "may I write THIS order" gate is the
// line-item RLS (parent own-draft for a member, any non-terminal for owner/admin).

const addLineSchema = z.object({
  orderId: idField,
  productId: z.string().uuid('Invalid product id'),
  quantity: quantityField,
  listPriceCents: z.coerce
    .number()
    .int('Invalid price')
    .nonnegative('Invalid price'),
});

export type AddLineInput = z.input<typeof addLineSchema>;

/**
 * Add a product line. The `listPriceCents` SNAPSHOT is passed in by the caller —
 * the ROUTE, which composes the products dev-API and reads the price server-side
 * — so a later catalog price change never rewrites this order's totals. Orders
 * never imports products (boundary rule B); the FK to products (RESTRICT, in the
 * migration) keeps the referenced product real.
 *
 * Each call APPENDS a new line — the same product may appear on multiple lines
 * (e.g. at different negotiated prices). The line's `line_number` is the next
 * free slot for the order (max + 1), giving stable per-order ordering; the
 * `unique(order_id, line_number)` constraint is the backstop against a race.
 */
export async function addLine(input: AddLineInput): Promise<void> {
  const { orderId } = await withPermission('update', 'Order', (ctx) =>
    withRateLimit(ordersWriteLimiter, `orders:line:add:${ctx.userId}`, async () => {
      const values = addLineSchema.parse(input);
      await withUserContext(ctx, async (tx) => {
        const [last] = await tx
          .select({ max: sql<number>`coalesce(max(${orderLines.lineNumber}), 0)` })
          .from(orderLines)
          .where(eq(orderLines.orderId, values.orderId));
        await tx
          .insert(orderLines)
          .values({ ...values, lineNumber: (last?.max ?? 0) + 1 });
      });
      return values;
    }),
  );

  revalidatePath(`/orders/${orderId}`);
}

/**
 * Edit a line in place — a PARTIAL update of whichever fields the form sends, so
 * the editable quantity and price cells can auto-save independently:
 *
 *   - `quantity` present  → set it (positive int).
 *   - `overridePriceCents` present → set the per-line price override; an EMPTY
 *     value clears it (`null`), reverting the line to its `list_price_cents`.
 *
 * The `list_price_cents` SNAPSHOT is never touched here — an override lives
 * alongside it, so off-list pricing stays auditable.
 */
export async function updateLine(formData: FormData): Promise<void> {
  const orderId = await withPermission('update', 'Order', (ctx) =>
    withRateLimit(ordersWriteLimiter, `orders:line:update:${ctx.userId}`, async () => {
      const id = idField.parse(String(formData.get('id') ?? ''));
      const order = idField.parse(String(formData.get('orderId') ?? ''));

      const set: { quantity?: number; overridePriceCents?: number | null } = {};
      if (formData.has('quantity')) {
        set.quantity = quantityField.parse(String(formData.get('quantity') ?? ''));
      }
      if (formData.has('overridePriceCents')) {
        const raw = String(formData.get('overridePriceCents') ?? '').trim();
        set.overridePriceCents = raw === '' ? null : overridePriceField.parse(raw);
      }

      await withUserContext(ctx, (tx) =>
        tx.update(orderLines).set(set).where(eq(orderLines.id, id)),
      );
      return order;
    }),
  );

  revalidatePath(`/orders/${orderId}`);
}

/** Remove a line from an order. */
export async function removeLine(formData: FormData): Promise<void> {
  const orderId = await withPermission('update', 'Order', (ctx) =>
    withRateLimit(ordersWriteLimiter, `orders:line:remove:${ctx.userId}`, async () => {
      const id = idField.parse(String(formData.get('id') ?? ''));
      const order = idField.parse(String(formData.get('orderId') ?? ''));
      await withUserContext(ctx, (tx) =>
        tx.delete(orderLines).where(eq(orderLines.id, id)),
      );
      return order;
    }),
  );

  revalidatePath(`/orders/${orderId}`);
}

// --- lifecycle transitions --------------------------------------------------

const transitionSchema = z.object({ orderId: idField, to: z.enum(ORDER_STATUSES) });

/**
 * Move an order to a new status. RLS already gates ROW ACCESS; this action is
 * the legality gate — it reads the current status and rejects any move
 * `canTransition` forbids for the caller's roles (e.g. a member processing, or
 * an illegal jump). Both layers must pass.
 */
export async function transitionOrder(formData: FormData): Promise<void> {
  const orderId = await withPermission('update', 'Order', (ctx) =>
    withRateLimit(ordersWriteLimiter, `orders:transition:${ctx.userId}`, async () => {
      const parsed = transitionSchema.parse({
        orderId: String(formData.get('orderId') ?? ''),
        to: String(formData.get('to') ?? ''),
      });
      await withUserContext(ctx, async (tx) => {
        const [order] = await tx
          .select({ status: orders.status })
          .from(orders)
          .where(eq(orders.id, parsed.orderId));
        if (!order) throw new Error('Order not found');
        if (!canTransition(ctx.roles, order.status as OrderStatus, parsed.to)) {
          throw new Error(`Illegal transition: ${order.status} → ${parsed.to}`);
        }
        await tx
          .update(orders)
          .set({ status: parsed.to, statusUpdatedAt: new Date() })
          .where(eq(orders.id, parsed.orderId));
      });
      return parsed.orderId;
    }),
  );

  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
}
