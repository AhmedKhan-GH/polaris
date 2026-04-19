import { eq } from 'drizzle-orm'
import { db } from '../db'
import { orders } from '../schema'
import { toOrder, type Order } from '../domain/order'

export async function findOrderById(id: string): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  return rows[0] ? toOrder(rows[0]) : null
}

export async function findAllOrders(): Promise<Order[]> {
  const rows = await db.select().from(orders)
  return rows.map(toOrder)
}

export async function insertOrder(input: { id: string }): Promise<Order> {
  const [row] = await db.insert(orders).values(input).returning()
  return toOrder(row)
}
