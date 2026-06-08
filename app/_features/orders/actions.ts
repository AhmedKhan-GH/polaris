'use server'

import { desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { orders } from '@/lib/db/schema'
import { withUserContext } from '@/lib/db/with-user-context'
import { withPermission } from '@/lib/permissions/guard'
import { withRateLimit, orderWriteLimiter } from '@/lib/rate-limit'

// Read orders the caller is allowed to see (RLS: own, or all for an owner).
// withPermission resolves the session and hands down the identity.
export async function getOrders() {
  return withPermission('read', 'Order', ({ userId, roles }) =>
    withUserContext({ userId, roles }, (tx) =>
      tx.select().from(orders).orderBy(desc(orders.createdAt)),
    ),
  )
}

// Create an order owned by the current user.
export async function createOrder() {
  await withPermission('create', 'Order', ({ userId, roles }) =>
    withRateLimit(orderWriteLimiter, `order:create:${userId}`, () =>
      withUserContext({ userId, roles }, (tx) =>
        tx.insert(orders).values({ createdBy: userId }),
      ),
    ),
  )
  revalidatePath('/orders')
}
