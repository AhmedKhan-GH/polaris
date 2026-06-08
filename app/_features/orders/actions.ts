'use server'

import { desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { orders } from '@/lib/db/schema'
import { withUserContext } from '@/lib/db/with-user-context'
import { withPermission } from '@/lib/permissions/guard'
import { withRateLimit, orderWriteLimiter } from '@/lib/rate-limit'

async function requireUser() {
  const session = await auth()
  const userId = (session as { userId?: string } | null)?.userId
  const roles = (session as { roles?: string[] } | null)?.roles ?? []
  if (!userId) throw new Error('Not authenticated')
  return { userId, roles }
}

// Read orders the caller is allowed to see (RLS: own, or all for an owner).
export async function getOrders() {
  return withPermission('read', 'Order', async () => {
    const { userId, roles } = await requireUser()
    return withUserContext({ userId, roles }, (tx) =>
      tx.select().from(orders).orderBy(desc(orders.createdAt)),
    )
  })
}

// Create an order owned by the current user.
export async function createOrder() {
  await withPermission('create', 'Order', async () => {
    const { userId, roles } = await requireUser()
    await withRateLimit(orderWriteLimiter, `order:create:${userId}`, () =>
      withUserContext({ userId, roles }, (tx) =>
        tx.insert(orders).values({ createdBy: userId }),
      ),
    )
  })
  revalidatePath('/orders')
}
