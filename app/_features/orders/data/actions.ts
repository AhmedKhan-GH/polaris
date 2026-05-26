'use server'

import { log } from '@/lib/log'
import { type Order, type OrderStatus } from '@/lib/domain/order'
import {
  countFilteredOrders,
  countFilteredOrdersByStatus,
  countOrders,
  countOrdersByStatus,
  discardDraftOrder,
  duplicateOrder,
  findFilteredOrdersPage,
  findOrderById,
  findOrdersPage,
  findOrdersPageByStatus,
  transitionOrderStatus,
  type OrderFilters,
  type OrderStatusCounts,
  type OrdersCursor,
} from '@/lib/db/orderRepository'
import { createOrder } from '@/lib/services/orderService'
import { getServerSupabase } from '@/lib/supabase/server'
import { getAllowedTransitions } from '@/lib/permissions/abilities'
import { withPermission } from '@/lib/permissions/guard'

async function getActorId(): Promise<string | null> {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function createOrderAction(): Promise<Order> {
  return withPermission('create', 'Order', async () => {
    const actor = await getActorId()
    try {
      return await createOrder(actor)
    } catch (err) {
      log.error({ err }, 'createOrderAction failed')
      throw err
    }
  })
}

export async function findOrdersPageAction(
  cursor: OrdersCursor | null,
  limit: number,
): Promise<Order[]> {
  return withPermission('read', 'Order', async ({ profile }) => {
    if (profile.role === 'guest') {
      return await findFilteredOrdersPage({ createdBy: profile.id }, cursor, limit)
    }
    return await findOrdersPage(cursor, limit)
  })
}

export async function findOrdersPageByStatusAction(
  status: OrderStatus,
  cursor: OrdersCursor | null,
  limit: number,
  dateFilters?: { createdFrom?: number; createdTo?: number },
): Promise<Order[]> {
  return withPermission('read', 'Order', async ({ profile }) => {
    const filters: OrderFilters = { statuses: [status], ...dateFilters }
    if (profile.role === 'guest') filters.createdBy = profile.id

    if (!dateFilters?.createdFrom && !dateFilters?.createdTo && profile.role !== 'guest') {
      return await findOrdersPageByStatus(status, cursor, limit)
    }

    return await findFilteredOrdersPage(filters, cursor, limit)
  })
}

export async function findFilteredOrdersPageAction(
  filters: OrderFilters,
  cursor: OrdersCursor | null,
  limit: number,
): Promise<Order[]> {
  return withPermission('read', 'Order', async ({ profile }) => {
    if (profile.role === 'guest') {
      return await findFilteredOrdersPage({ ...filters, createdBy: profile.id }, cursor, limit)
    }
    return await findFilteredOrdersPage(filters, cursor, limit)
  })
}

export async function countOrdersAction(): Promise<number> {
  return withPermission('read', 'Order', async ({ profile }) => {
    if (profile.role === 'guest') {
      return await countFilteredOrders({ createdBy: profile.id })
    }
    return await countOrders()
  })
}

export async function countFilteredOrdersAction(
  filters: OrderFilters,
): Promise<number> {
  return withPermission('read', 'Order', async ({ profile }) => {
    if (profile.role === 'guest') {
      return await countFilteredOrders({ ...filters, createdBy: profile.id })
    }
    return await countFilteredOrders(filters)
  })
}

export async function countFilteredOrdersByStatusAction(
  filters: OrderFilters,
): Promise<OrderStatusCounts> {
  return withPermission('read', 'Order', async ({ profile }) => {
    if (profile.role === 'guest') {
      return await countFilteredOrdersByStatus({ ...filters, createdBy: profile.id })
    }
    return await countFilteredOrdersByStatus(filters)
  })
}

export async function countOrdersByStatusAction(): Promise<OrderStatusCounts> {
  return withPermission('read', 'Order', async ({ profile }) => {
    if (profile.role === 'guest') {
      return await countFilteredOrdersByStatus({ createdBy: profile.id })
    }
    return await countOrdersByStatus()
  })
}

export async function transitionOrderAction(args: {
  orderId: string
  toStatus: OrderStatus
  reason?: string
}): Promise<Order> {
  return withPermission('transition', 'Order', async ({ profile }) => {
    const order = await findOrderById(args.orderId)
    if (!order) throw new Error('Order not found')

    const allowed = getAllowedTransitions(profile.role, order.status)
    if (!allowed.includes(args.toStatus)) {
      throw new Error(`Transition to ${args.toStatus} is not allowed`)
    }

    const actor = await getActorId()
    try {
      return await transitionOrderStatus({
        orderId: args.orderId,
        toStatus: args.toStatus,
        changedBy: actor,
        reason: args.reason,
      })
    } catch (err) {
      log.warn(
        { err, orderId: args.orderId, toStatus: args.toStatus },
        'transitionOrderAction rejected',
      )
      throw err
    }
  })
}

export async function discardDraftOrderAction(args: {
  orderId: string
  reason?: string
}): Promise<Order> {
  return withPermission('discard', 'Order', async ({ profile }) => {
    const order = await findOrderById(args.orderId)
    if (!order) throw new Error('Order not found')

    const allowed = getAllowedTransitions(profile.role, order.status)
    if (!allowed.includes('discarded')) {
      throw new Error('Discard is not allowed for this order')
    }

    const actor = await getActorId()
    try {
      return await discardDraftOrder({
        orderId: args.orderId,
        changedBy: actor,
        reason: args.reason,
      })
    } catch (err) {
      log.warn({ err, orderId: args.orderId }, 'discardDraftOrderAction rejected')
      throw err
    }
  })
}

export async function duplicateOrderAction(args: {
  sourceOrderId: string
}): Promise<Order> {
  return withPermission('duplicate', 'Order', async () => {
    const actor = await getActorId()
    try {
      return await duplicateOrder({
        sourceOrderId: args.sourceOrderId,
        changedBy: actor,
      })
    } catch (err) {
      log.warn(
        { err, sourceOrderId: args.sourceOrderId },
        'duplicateOrderAction rejected',
      )
      throw err
    }
  })
}
