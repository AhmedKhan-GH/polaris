'use server'

import { ForbiddenError } from '@casl/ability'
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
import {
  deleteOrderLineItem,
  findActiveSkuOptions,
  findSkus,
  findOrderLineItems,
  insertOrderLineItem,
  insertSku,
  updateSku,
  updateOrderLineItem,
} from '@/lib/db/orderLineItemRepository'
import type {
  OrderLineItem,
  Sku,
  SkuOption,
} from '@/lib/domain/orderLineItem'
import { createOrder } from '@/lib/services/orderService'
import { getServerSupabase } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor, getAllowedTransitions } from '@/lib/abilities'

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

function requiredText(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

function positiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero`)
  }
  return value
}

function optionalNonNegativeNumber(
  value: number | null | undefined,
  label: string,
): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be zero or greater`)
  }
  return value
}

async function getScopedOrder(orderId: string) {
  const { ability, profile } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')

  const order = await findOrderById(orderId)
  if (!order) throw new Error('Order not found')
  if (profile.role === 'guest' && order.createdBy !== profile.id) {
    throw new Error('Order not found')
  }

  return { ability, profile, order }
}

async function getEditableOrder(orderId: string) {
  const result = await getScopedOrder(orderId)
  ForbiddenError.from(result.ability).throwUnlessCan('create', 'Order')
  if (result.order.status !== 'drafted') {
    throw new Error('Line items can only be edited on drafted orders')
  }
  return result
}

export async function createOrderAction(): Promise<Order> {
  const { ability } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('create', 'Order')

  const actor = await getActorId()
  try {
    return await createOrder(actor)
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
  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')

  if (profile.role === 'guest') {
    return await findFilteredOrdersPage({ createdBy: profile.id }, cursor, limit)
  }

  return await findOrdersPage(cursor, limit)
}

export async function findOrdersPageByStatusAction(
  status: OrderStatus,
  cursor: OrdersCursor | null,
  limit: number,
  dateFilters?: { createdFrom?: number; createdTo?: number },
): Promise<Order[]> {
  const { ability, profile } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')

  const filters: OrderFilters = { statuses: [status], ...dateFilters }
  if (profile.role === 'guest') filters.createdBy = profile.id

  if (!dateFilters?.createdFrom && !dateFilters?.createdTo && profile.role !== 'guest') {
    return await findOrdersPageByStatus(status, cursor, limit)
  }

  return await findFilteredOrdersPage(filters, cursor, limit)
}

export async function findFilteredOrdersPageAction(
  filters: OrderFilters,
  cursor: OrdersCursor | null,
  limit: number,
): Promise<Order[]> {
  const { ability, profile } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')

  if (profile.role === 'guest') {
    return await findFilteredOrdersPage({ ...filters, createdBy: profile.id }, cursor, limit)
  }

  return await findFilteredOrdersPage(filters, cursor, limit)
}

export async function countOrdersAction(): Promise<number> {
  const { ability, profile } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')

  if (profile.role === 'guest') {
    return await countFilteredOrders({ createdBy: profile.id })
  }
  return await countOrders()
}

export async function countFilteredOrdersAction(
  filters: OrderFilters,
): Promise<number> {
  const { ability, profile } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')

  if (profile.role === 'guest') {
    return await countFilteredOrders({ ...filters, createdBy: profile.id })
  }

  return await countFilteredOrders(filters)
}

export async function countFilteredOrdersByStatusAction(
  filters: OrderFilters,
): Promise<OrderStatusCounts> {
  const { ability, profile } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')

  if (profile.role === 'guest') {
    return await countFilteredOrdersByStatus({ ...filters, createdBy: profile.id })
  }

  return await countFilteredOrdersByStatus(filters)
}

export async function countOrdersByStatusAction(): Promise<OrderStatusCounts> {
  const { ability, profile } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('read', 'Order')

  if (profile.role === 'guest') {
    return await countFilteredOrdersByStatus({ createdBy: profile.id })
  }
  return await countOrdersByStatus()
}

export async function transitionOrderAction(args: {
  orderId: string
  toStatus: OrderStatus
  reason?: string
}): Promise<Order> {
  const { ability, profile } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('transition', 'Order')

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
}

export async function discardDraftOrderAction(args: {
  orderId: string
  reason?: string
}): Promise<Order> {
  const { ability, profile } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('discard', 'Order')

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

export async function findSkuOptionsAction(): Promise<SkuOption[]> {
  const { ability } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('read', 'Sku')
  return findActiveSkuOptions()
}

export async function findSkusAction(): Promise<Sku[]> {
  const { ability } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('manage', 'Sku')
  return findSkus()
}

export async function createSkuAction(args: {
  skuNumber: string
  name: string
  defaultUnit?: string | null
}): Promise<SkuOption> {
  const { ability } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('manage', 'Sku')

  return insertSku({
    skuNumber: requiredText(args.skuNumber, 'SKU number'),
    name: requiredText(args.name, 'SKU name'),
    defaultUnit: args.defaultUnit?.trim() || null,
  })
}

export async function updateSkuAction(args: {
  id: string
  skuNumber: string
  name: string
  defaultUnit?: string | null
  category?: string | null
  isActive: boolean
}): Promise<Sku> {
  const { ability } = await getAbility()
  ForbiddenError.from(ability).throwUnlessCan('manage', 'Sku')

  const updated = await updateSku({
    id: requiredText(args.id, 'SKU'),
    skuNumber: requiredText(args.skuNumber, 'SKU number'),
    name: requiredText(args.name, 'SKU name'),
    defaultUnit: args.defaultUnit?.trim() || null,
    category: args.category?.trim() || null,
    isActive: args.isActive,
  })
  if (!updated) throw new Error('SKU not found')
  return updated
}

export async function findOrderLineItemsAction(
  orderId: string,
): Promise<OrderLineItem[]> {
  const { ability } = await getScopedOrder(orderId)
  ForbiddenError.from(ability).throwUnlessCan('read', 'OrderItem')
  return findOrderLineItems(orderId)
}

export async function createOrderLineItemAction(args: {
  orderId: string
  skuId: string
  quantity: number
  unit: string
  unitPrice?: number | null
}): Promise<OrderLineItem> {
  const { ability } = await getEditableOrder(args.orderId)
  ForbiddenError.from(ability).throwUnlessCan('create', 'OrderItem')
  return insertOrderLineItem({
    orderId: args.orderId,
    skuId: requiredText(args.skuId, 'SKU'),
    quantity: positiveNumber(args.quantity, 'Quantity'),
    unit: requiredText(args.unit, 'Unit'),
    unitPrice: optionalNonNegativeNumber(args.unitPrice, 'Unit price'),
  })
}

export async function updateOrderLineItemAction(args: {
  orderId: string
  lineItemId: string
  quantity: number
  unit: string
  unitPrice?: number | null
}): Promise<OrderLineItem> {
  const { ability } = await getEditableOrder(args.orderId)
  ForbiddenError.from(ability).throwUnlessCan('update', 'OrderItem')
  const updated = await updateOrderLineItem({
    id: requiredText(args.lineItemId, 'Line item'),
    orderId: args.orderId,
    quantity: positiveNumber(args.quantity, 'Quantity'),
    unit: requiredText(args.unit, 'Unit'),
    unitPrice: optionalNonNegativeNumber(args.unitPrice, 'Unit price'),
  })
  if (!updated || updated.orderId !== args.orderId) {
    throw new Error('Order line item not found')
  }
  return updated
}

export async function deleteOrderLineItemAction(args: {
  orderId: string
  lineItemId: string
}): Promise<{ id: string; orderId: string }> {
  const { ability } = await getEditableOrder(args.orderId)
  ForbiddenError.from(ability).throwUnlessCan('delete', 'OrderItem')
  const deleted = await deleteOrderLineItem({
    id: requiredText(args.lineItemId, 'Line item'),
    orderId: args.orderId,
  })
  if (!deleted || deleted.orderId !== args.orderId) {
    throw new Error('Order line item not found')
  }
  return deleted
}
