import { and, count, desc, eq, lt, or, sql } from 'drizzle-orm'
import { db } from '../db'
import { log } from '../log'
import { orders, orderStatusCounts, orderStatusHistory } from '../schema'
import {
  ORDER_STATUSES,
  toOrder,
  type Order,
  type OrderStatus,
} from '../domain/order'

export type OrdersCursor = { createdAt: string; id: string }

// Forward-only graph. Mirrors enforce_forward_status as last updated in
// drizzle/0016_rename_completed_to_closed.sql. Keep the two in lockstep
// --- if you change the graph, change both.
export const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  drafted:  ['submitted', 'discarded'],
  submitted: ['invoiced',  'rejected'],
  invoiced:  ['closed',    'voided'],
  closed:    ['archived'],
  archived:  [],
  discarded: [],
  rejected:  [],
  voided:    [],
}

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`)
    this.name = 'OrderNotFoundError'
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Invalid order status transition: ${from} -> ${to}`)
    this.name = 'InvalidTransitionError'
  }
}

export async function findOrderById(id: string): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  const order = rows[0] ? toOrder(rows[0]) : null
  log.debug({ id, found: order !== null }, 'findOrderById')
  return order
}

export async function findAllOrders(): Promise<Order[]> {
  const rows = await db.select().from(orders)
  log.debug({ count: rows.length }, 'findAllOrders')
  return rows.map(toOrder)
}

export async function findOrdersPage(
  cursor: OrdersCursor | null,
  limit: number,
): Promise<Order[]> {
  const where = cursor
    ? or(
        lt(orders.createdAt, sql`${cursor.createdAt}::timestamp`),
        and(
          eq(orders.createdAt, sql`${cursor.createdAt}::timestamp`),
          lt(orders.id, sql`${cursor.id}::uuid`),
        ),
      )
    : undefined
  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(limit)
  log.debug({ cursor, limit, count: rows.length }, 'findOrdersPage')
  return rows.map(toOrder)
}

// Same cursor-ordered scan as findOrdersPage but filtered to a single
// status. Each kanban column owns its own cursor through this so a
// sparse status (Closed) doesn't have to wait for the global newest-
// first stream to walk past every fresher draft.
export async function findOrdersPageByStatus(
  status: OrderStatus,
  cursor: OrdersCursor | null,
  limit: number,
): Promise<Order[]> {
  const cursorWhere = cursor
    ? or(
        lt(orders.createdAt, sql`${cursor.createdAt}::timestamp`),
        and(
          eq(orders.createdAt, sql`${cursor.createdAt}::timestamp`),
          lt(orders.id, sql`${cursor.id}::uuid`),
        ),
      )
    : undefined
  const where = cursorWhere
    ? and(eq(orders.status, status), cursorWhere)
    : eq(orders.status, status)
  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(limit)
  log.debug({ status, cursor, limit, count: rows.length }, 'findOrdersPageByStatus')
  return rows.map(toOrder)
}


export async function insertOrder(): Promise<Order> {
  const [row] = await db.insert(orders).values({}).returning()
  log.debug({ orderId: row.id, orderNumber: row.orderNumber }, 'insertOrder')
  return toOrder(row)
}

export async function countOrders(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(orders)
  // Defensive: Postgres bigint can come back as string from node-postgres
  // depending on driver config. Coerce explicitly so callers always
  // receive a plain number, not "282" or 282n.
  const n = Number(row.value)
  log.debug({ count: n, raw: row.value, type: typeof row.value }, 'countOrders')
  return Number.isFinite(n) ? n : 0
}

export type OrderStatusCounts = Record<OrderStatus, number>

// O(1)-ish lookup against the trigger-maintained order_status_counts
// table (one row per enum value, ~8 rows total). The trigger on
// `orders` keeps this table in lockstep with INSERT/UPDATE/DELETE in
// the same transaction, so the read here is always consistent with
// committed state without a GROUP BY scan over the orders table.
export async function countOrdersByStatus(): Promise<OrderStatusCounts> {
  const rows = await db
    .select({ status: orderStatusCounts.status, count: orderStatusCounts.count })
    .from(orderStatusCounts)

  const result = Object.fromEntries(
    ORDER_STATUSES.map((s) => [s, 0]),
  ) as OrderStatusCounts
  for (const row of rows) {
    result[row.status] = Number(row.count)
  }
  log.debug({ counts: result }, 'countOrdersByStatus')
  return result
}

export async function transitionOrderStatus(args: {
  orderId: string
  toStatus: OrderStatus
  changedBy: string | null
  reason?: string
}): Promise<Order> {
  const { orderId, toStatus, changedBy, reason } = args
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for('update')
    if (!current) throw new OrderNotFoundError(orderId)

    if (!isValidTransition(current.status, toStatus)) {
      throw new InvalidTransitionError(current.status, toStatus)
    }

    const [updated] = await tx
      .update(orders)
      .set({ status: toStatus, statusUpdatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning()

    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: current.status,
      toStatus,
      changedBy,
      reason,
    })

    log.info(
      {
        orderId,
        from: current.status,
        to: toStatus,
        changedBy,
      },
      'order status transitioned',
    )
    return toOrder(updated)
  })
}

export async function discardDraftOrder(args: {
  orderId: string
  changedBy: string | null
  reason?: string
}): Promise<Order> {
  return transitionOrderStatus({
    ...args,
    toStatus: 'discarded',
  })
}

export async function duplicateOrder(args: {
  sourceOrderId: string
  changedBy: string | null
}): Promise<Order> {
  const { sourceOrderId, changedBy } = args
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, sourceOrderId))
      .limit(1)
    if (!source) throw new OrderNotFoundError(sourceOrderId)

    const [created] = await tx
      .insert(orders)
      .values({ duplicatedFromOrderId: source.id })
      .returning()

    await tx.insert(orderStatusHistory).values({
      orderId: created.id,
      fromStatus: null,
      toStatus: 'drafted',
      changedBy,
      reason: `Duplicated from order #${source.orderNumber}`,
    })

    log.info(
      {
        newOrderId: created.id,
        newOrderNumber: created.orderNumber,
        sourceOrderId: source.id,
        sourceOrderNumber: source.orderNumber,
        changedBy,
      },
      'order duplicated',
    )
    return toOrder(created)
  })
}
