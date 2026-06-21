'use server';

import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { withUserContext } from '@/lib/db/with-user-context';
import { withPermission } from '@/lib/permissions/guard';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limit';

import { orders } from './schema';

/**
 * Write budget for orders, OWNED by this feature (Charter D6). 30 writes / 60s
 * per acting user.
 */
const ordersWriteLimiter = createRateLimiter({ points: 30, duration: 60 });

const idField = z.string().uuid('Invalid order id');

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
