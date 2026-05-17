import { insertOrder } from '../db/orderRepository'
import { log } from '../log'
import type { Order } from '../domain/order'

export async function createOrder(createdBy?: string | null): Promise<Order> {
  const order = await insertOrder(createdBy)
  log.info(
    { orderId: order.id, orderNumber: order.orderNumber, createdBy },
    'order created',
  )
  return order
}
