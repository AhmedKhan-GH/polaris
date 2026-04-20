import { insertOrder } from '../db/orderRepository'
import { log } from '../log'
import type { Order } from '../domain/order'

export async function createOrder({ id }: { id: string }): Promise<Order> {
  const order = await insertOrder({ id })
  log.info(
    { orderId: order.id, orderNumber: order.orderNumber },
    'order created',
  )
  return order
}
