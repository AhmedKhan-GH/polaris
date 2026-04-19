import { randomUUID } from 'node:crypto'
import { insertOrder } from '../db/orderRepository'
import type { Order } from '../domain/order'

export async function createOrder(): Promise<Order> {
  return insertOrder({ id: randomUUID() })
}
