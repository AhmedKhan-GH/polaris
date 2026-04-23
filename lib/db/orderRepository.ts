import { eq } from 'drizzle-orm'
import { db } from '../db'
import { log } from '../log'
import { orders } from '../schema'
import { toOrder, type Order } from '../domain/order'

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

export async function insertOrder(
  input?: { correlationId?: string },
): Promise<Order> {
  const [row] = await db
    .insert(orders)
    .values({ clientCorrelationId: input?.correlationId ?? null })
    .returning()
  log.debug({ orderId: row.id, orderNumber: row.orderNumber }, 'insertOrder')
  return toOrder(row)
}
