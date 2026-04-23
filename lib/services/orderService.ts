import { insertOrder } from '../db/orderRepository'
import { log } from '../log'
import type { Order } from '../domain/order'

export async function createOrder(
  input?: { correlationId?: string },
): Promise<Order> {
  const order = await insertOrder(input)
  log.info(
    { orderId: order.id, orderNumber: order.orderNumber },
    'order created',
  )
  return order
}
