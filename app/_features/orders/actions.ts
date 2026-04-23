'use server'

import { log } from '@/lib/log'
import type { Order } from '@/lib/domain/order'
import { createOrder } from '@/lib/services/orderService'

export async function createOrderAction(
  correlationId?: string,
): Promise<Order> {
  try {
    return await createOrder({ correlationId })
  } catch (err) {
    log.error({ err }, 'createOrderAction failed')
    throw err
  }
}
