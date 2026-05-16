'use server'

import { ForbiddenError } from '@casl/ability'
import { log } from '@/lib/log'
import type { Order, OrderStatus } from '@/lib/domain/order'
import {
  countFilteredOrders,
  countFilteredOrdersByStatus,
  countOrders,
  countOrdersByStatus,
  discardDraftOrder,
  duplicateOrder,
  findFilteredOrdersPage,
  findOrdersPage,
  findOrdersPageByStatus,
  transitionOrderStatus,
  type OrderFilters,
  type OrderStatusCounts,
  type OrdersCursor,
} from '@/lib/db/orderRepository'
import { createOrder } from '@/lib/services/orderService'
import { getServerSupabase } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'

async function getActorId(): Promise<string | null> {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function getAbility() {
  const profile = await getProfile()
  if (!profile) throw new Error('Unauthenticated')
  return { ability: defineAbilityFor(profile.role), profile }
}

export async function createOrderAction(): Promise<Order> {
  const { ability } = await getAbility()
  if (!ability.can('create', 'DraftOrder') && !ability.can('create', 'Order')) {
    ForbiddenError.from(ability).throwUnlessCan('create', 'Order')
  }

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
  const { ability, profile } = await getAbility()

  if (profile.role === 'member') {
    ForbiddenError.from(ability).throwUnlessCan('read', 'DraftOrder')
    return await findOrdersPageByStatus('drafted', cursor, limit)
  }

  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')
  return await findOrdersPage(cursor, limit)
}

export async function findOrdersPageByStatusAction(
  status: OrderStatus,
  cursor: OrdersCursor | null,
  limit: number,
): Promise<Order[]> {
  const { ability, profile } = await getAbility()

  if (profile.role === 'member') {
    ForbiddenError.from(ability).throwUnlessCan('read', 'DraftOrder')
    if (status !== 'drafted') return []
    return await findOrdersPageByStatus('drafted', cursor, limit)
  }

  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')
  return await findOrdersPageByStatus(status, cursor, limit)
}

export async function findFilteredOrdersPageAction(
  filters: OrderFilters,
  cursor: OrdersCursor | null,
  limit: number,
): Promise<Order[]> {
  const { ability, profile } = await getAbility()

  if (profile.role === 'member') {
    ForbiddenError.from(ability).throwUnlessCan('read', 'DraftOrder')
    const memberFilters: OrderFilters = { ...filters, statuses: ['drafted'] }
    return await findFilteredOrdersPage(memberFilters, cursor, limit)
  }

  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')
  return await findFilteredOrdersPage(filters, cursor, limit)
}

export async function countOrdersAction(): Promise<number> {
  const { ability } = await getAbility()
  if (!ability.can('read', 'Order') && !ability.can('read', 'DraftOrder')) {
    ForbiddenError.from(ability).throwUnlessCan('read', 'Order')
  }
  return await countOrders()
}

export async function countFilteredOrdersAction(
  filters: OrderFilters,
): Promise<number> {
  const { ability, profile } = await getAbility()

  if (profile.role === 'member') {
    ForbiddenError.from(ability).throwUnlessCan('read', 'DraftOrder')
    return await countFilteredOrders({ ...filters, statuses: ['drafted'] })
  }

  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')
  return await countFilteredOrders(filters)
}

export async function countFilteredOrdersByStatusAction(
  filters: OrderFilters,
): Promise<OrderStatusCounts> {
  const { ability, profile } = await getAbility()

  if (profile.role === 'member') {
    ForbiddenError.from(ability).throwUnlessCan('read', 'DraftOrder')
    return await countFilteredOrdersByStatus({ ...filters, statuses: ['drafted'] })
  }

  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')
  return await countFilteredOrdersByStatus(filters)
}

export async function countOrdersByStatusAction(): Promise<OrderStatusCounts> {
  const { ability } = await getAbility()
  if (!ability.can('read', 'Order') && !ability.can('read', 'DraftOrder')) {
    ForbiddenError.from(ability).throwUnlessCan('read', 'Order')
  }
  return await countOrdersByStatus()
}

export async function transitionOrderAction(args: {
  orderId: string
  toStatus: OrderStatus
  reason?: string
}): Promise<Order> {
  const { ability } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('transition', 'Order')

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
  const { ability } = await getAbility()
  if (!ability.can('discard', 'DraftOrder') && !ability.can('discard', 'Order')) {
    ForbiddenError.from(ability).throwUnlessCan('discard', 'Order')
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
}

export async function duplicateOrderAction(args: {
  sourceOrderId: string
}): Promise<Order> {
  const { ability } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('duplicate', 'Order')

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
