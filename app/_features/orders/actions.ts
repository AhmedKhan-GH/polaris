'use server'

import { log } from '@/lib/log'
import type { Order } from '@/lib/domain/order'
import {
  countOrders,
  findOrdersPage,
  type OrdersCursor,
} from '@/lib/db/orderRepository'
import { createOrder } from '@/lib/services/orderService'

export async function createOrderAction(): Promise<Order> {
  try {
    return await createOrder()
  } catch (err) {
    log.error({ err }, 'createOrderAction failed')
    throw err
  }
}

export async function findOrdersPageAction(
  cursor: OrdersCursor | null,
  limit: number,
): Promise<Order[]> {
  return await findOrdersPage(cursor, limit)
}

export async function countOrdersAction(): Promise<number> {
  return await countOrders()
}
