import { and, desc, eq, lt, or, sql } from 'drizzle-orm'
import { db } from '../db'
import { log } from '../log'
import { orders } from '../schema'
import { toOrder, type Order } from '../domain/order'

export type OrdersCursor = { createdAt: string; id: string }

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

// Cursor-paginated newest-first feed. The (createdAt, id) tuple breaks
// same-millisecond ties so callers never skip rows. A null cursor returns
// the first page.
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

export async function insertOrder(): Promise<Order> {
  const [row] = await db.insert(orders).values({}).returning()
  log.debug({ orderId: row.id, orderNumber: row.orderNumber }, 'insertOrder')
  return toOrder(row)
}
