'use server'

import { z } from 'zod'
import { log } from '@/lib/log'
import { type Order, ORDER_STATUSES } from '@/lib/domain/order'
import {
  countFilteredOrders,
  countFilteredOrdersByStatus,
  countOrders,
  countOrdersByStatus,
  cancelOrder,
  duplicateOrder,
  findFilteredOrdersPage,
  findOrderById,
  findOrdersPage,
  findOrdersPageByStatus,
  transitionOrderStatus,
  type OrderStatusCounts,
} from '@/lib/db/orderRepository'
import { createOrder } from '@/lib/services/orderService'
import { getServerSupabase } from '@/lib/supabase/server'
import { getAllowedTransitions } from '@/lib/permissions/abilities'
import { withPermission } from '@/lib/permissions/guard'

const orderStatusSchema = z.enum(ORDER_STATUSES)

const cursorSchema = z
  .object({
    createdAt: z.number().int(),
    id: z.string().uuid(),
  })
  .nullable()

const limitSchema = z.number().int().min(1).max(100)

const filtersSchema = z.object({
  statuses: z.array(orderStatusSchema).optional(),
  createdBy: z.string().uuid().optional(),
  createdFrom: z.number().int().optional(),
  createdTo: z.number().int().optional(),
})

const dateFiltersSchema = z
  .object({
    createdFrom: z.number().int().optional(),
    createdTo: z.number().int().optional(),
  })
  .optional()

const transitionInput = z.object({
  orderId: z.string().uuid(),
  toStatus: orderStatusSchema,
  reason: z.string().max(1000).optional(),
})

const discardInput = z.object({
  orderId: z.string().uuid(),
  reason: z.string().max(1000).optional(),
})

const duplicateInput = z.object({
  sourceOrderId: z.string().uuid(),
})

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
  rawCursor: unknown,
  rawLimit: unknown,
): Promise<Order[]> {
  const cursor = cursorSchema.parse(rawCursor)
  const limit = limitSchema.parse(rawLimit)

  return withPermission('read', 'Order', async ({ profile }) => {
    if (profile.role === 'guest') {
      return await findFilteredOrdersPage({ createdBy: profile.id }, cursor, limit)
    }
    return await findOrdersPage(cursor, limit)
  })
}

export async function findOrdersPageByStatusAction(
  rawStatus: unknown,
  rawCursor: unknown,
  rawLimit: unknown,
  rawDateFilters?: unknown,
): Promise<Order[]> {
  const status = orderStatusSchema.parse(rawStatus)
  const cursor = cursorSchema.parse(rawCursor)
  const limit = limitSchema.parse(rawLimit)
  const dateFilters = dateFiltersSchema.parse(rawDateFilters)

  return withPermission('read', 'Order', async ({ profile }) => {
    const filters = { statuses: [status] as const, ...dateFilters }
    if (profile.role === 'guest') (filters as any).createdBy = profile.id

    if (!dateFilters?.createdFrom && !dateFilters?.createdTo && profile.role !== 'guest') {
      return await findOrdersPageByStatus(status, cursor, limit)
    }

    return await findFilteredOrdersPage(filters, cursor, limit)
  })
}

export async function findFilteredOrdersPageAction(
  rawFilters: unknown,
  rawCursor: unknown,
  rawLimit: unknown,
): Promise<Order[]> {
  const filters = filtersSchema.parse(rawFilters)
  const cursor = cursorSchema.parse(rawCursor)
  const limit = limitSchema.parse(rawLimit)

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
  rawFilters: unknown,
): Promise<number> {
  const filters = filtersSchema.parse(rawFilters)

  return withPermission('read', 'Order', async ({ profile }) => {
    if (profile.role === 'guest') {
      return await countFilteredOrders({ ...filters, createdBy: profile.id })
    }
    return await countFilteredOrders(filters)
  })
}

export async function countFilteredOrdersByStatusAction(
  rawFilters: unknown,
): Promise<OrderStatusCounts> {
  const filters = filtersSchema.parse(rawFilters)

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

export async function transitionOrderAction(rawArgs: unknown): Promise<Order> {
  const args = transitionInput.parse(rawArgs)

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

export async function cancelOrderAction(rawArgs: unknown): Promise<Order> {
  const args = discardInput.parse(rawArgs)

  return withPermission('cancel', 'Order', async ({ profile }) => {
    const order = await findOrderById(args.orderId)
    if (!order) throw new Error('Order not found')

    const allowed = getAllowedTransitions(profile.role, order.status)
    if (!allowed.includes('cancelled')) {
      throw new Error('Cancellation is not allowed for this order')
    }

    const actor = await getActorId()
    try {
      return await cancelOrder({
        orderId: args.orderId,
        changedBy: actor,
        reason: args.reason,
      })
    } catch (err) {
      log.warn({ err, orderId: args.orderId }, 'cancelOrderAction rejected')
      throw err
    }
  })
}

export async function duplicateOrderAction(rawArgs: unknown): Promise<Order> {
  const args = duplicateInput.parse(rawArgs)

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
