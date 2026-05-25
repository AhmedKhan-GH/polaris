import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { orderLineItems, skus } from '../schema'
import {
  toOrderLineItem,
  toSkuOption,
  type OrderLineItem,
  type SkuOption,
} from '../domain/orderLineItem'

const lineItemWithSku = {
  id: orderLineItems.id,
  orderId: orderLineItems.orderId,
  skuId: orderLineItems.skuId,
  skuNumber: skus.skuNumber,
  skuName: skus.name,
  lineNumber: orderLineItems.lineNumber,
  quantity: orderLineItems.quantity,
  unit: orderLineItems.unit,
  unitPrice: orderLineItems.unitPrice,
  notes: orderLineItems.notes,
  createdAt: orderLineItems.createdAt,
  updatedAt: orderLineItems.updatedAt,
}

function lineItemsWithSku() {
  return db
    .select(lineItemWithSku)
    .from(orderLineItems)
    .innerJoin(skus, eq(orderLineItems.skuId, skus.id))
}

export async function findActiveSkuOptions(): Promise<SkuOption[]> {
  const rows = await db
    .select({
      id: skus.id,
      skuNumber: skus.skuNumber,
      name: skus.name,
      defaultUnit: skus.defaultUnit,
    })
    .from(skus)
    .where(eq(skus.isActive, true))
    .orderBy(asc(skus.skuNumber), asc(skus.name))

  return rows.map(toSkuOption)
}

export async function insertSku(args: {
  skuNumber: string
  name: string
  defaultUnit?: string | null
}): Promise<SkuOption> {
  const [created] = await db
    .insert(skus)
    .values({
      skuNumber: args.skuNumber,
      name: args.name,
      defaultUnit: args.defaultUnit || null,
    })
    .returning({
      id: skus.id,
      skuNumber: skus.skuNumber,
      name: skus.name,
      defaultUnit: skus.defaultUnit,
    })

  return toSkuOption(created)
}

export async function findOrderLineItems(
  orderId: string,
): Promise<OrderLineItem[]> {
  const rows = await lineItemsWithSku()
    .where(eq(orderLineItems.orderId, orderId))
    .orderBy(
      asc(orderLineItems.lineNumber),
      asc(orderLineItems.createdAt),
      asc(orderLineItems.id),
    )

  return rows.map(toOrderLineItem)
}

async function findOrderLineItemById(
  lineItemId: string,
): Promise<OrderLineItem | null> {
  const [row] = await lineItemsWithSku()
    .where(eq(orderLineItems.id, lineItemId))
    .limit(1)

  return row ? toOrderLineItem(row) : null
}

export async function insertOrderLineItem(args: {
  orderId: string
  skuId: string
  quantity: number
  unit: string
  unitPrice?: number | null
  notes?: string | null
}): Promise<OrderLineItem> {
  const lineItemId = await db.transaction(async (tx) => {
    const [line] = await tx
      .select({
        value: sql<number>`coalesce(max(${orderLineItems.lineNumber}), 0)::int`,
      })
      .from(orderLineItems)
      .where(eq(orderLineItems.orderId, args.orderId))

    const [created] = await tx
      .insert(orderLineItems)
      .values({
        orderId: args.orderId,
        skuId: args.skuId,
        lineNumber: (line?.value ?? 0) + 1,
        quantity: String(args.quantity),
        unit: args.unit,
        unitPrice:
          args.unitPrice === null || args.unitPrice === undefined
            ? null
            : String(args.unitPrice),
        notes: args.notes || null,
      })
      .returning({ id: orderLineItems.id })

    return created.id
  })

  const lineItem = await findOrderLineItemById(lineItemId)
  if (!lineItem) throw new Error(`Order line item not found after insert: ${lineItemId}`)
  return lineItem
}

export async function updateOrderLineItem(args: {
  id: string
  orderId: string
  quantity: number
  unit: string
  unitPrice?: number | null
  notes?: string | null
}): Promise<OrderLineItem | null> {
  const [updated] = await db
    .update(orderLineItems)
    .set({
      quantity: String(args.quantity),
      unit: args.unit,
      unitPrice:
        args.unitPrice === null || args.unitPrice === undefined
          ? null
          : String(args.unitPrice),
      notes: args.notes || null,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(orderLineItems.id, args.id),
        eq(orderLineItems.orderId, args.orderId),
      ),
    )
    .returning({ id: orderLineItems.id })

  return updated ? findOrderLineItemById(updated.id) : null
}

export async function deleteOrderLineItem(
  args: { id: string; orderId: string },
): Promise<{ id: string; orderId: string } | null> {
  const [deleted] = await db
    .delete(orderLineItems)
    .where(
      and(
        eq(orderLineItems.id, args.id),
        eq(orderLineItems.orderId, args.orderId),
      ),
    )
    .returning({
      id: orderLineItems.id,
      orderId: orderLineItems.orderId,
    })

  return deleted ?? null
}
