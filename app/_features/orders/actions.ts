'use server'

import { log } from '@/lib/log'
import type { Order, OrderStatus } from '@/lib/domain/order'
import {
  countOrders,
  discardDraftOrder,
  duplicateOrder,
  findOrdersPage,
  transitionOrderStatus,
  type OrdersCursor,
} from '@/lib/db/orderRepository'
import { createOrder } from '@/lib/services/orderService'
import { getServerSupabase } from '@/lib/supabase/server'

async function getActorId(): Promise<string | null> {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function createOrderAction(): Promise<Order> {
  try {
    return await createOrder()
  } catch (err) {
    log.error({ err }, 'createOrderAction failed')
    throw err
  }
}

export async function findOrdersPageAction(
  cursor: OrdersCursor | null,
  limit: number,
): Promise<Order[]> {
  return await findOrdersPage(cursor, limit)
}

export async function countOrdersAction(): Promise<number> {
  return await countOrders()
}

export async function transitionOrderAction(args: {
  orderId: string
  toStatus: OrderStatus
  reason?: string
}): Promise<Order> {
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
}

export async function discardDraftOrderAction(args: {
  orderId: string
  reason?: string
}): Promise<Order> {
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
}

export async function duplicateOrderAction(args: {
  sourceOrderId: string
}): Promise<Order> {
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
}
