'use server'

import { log } from '@/lib/log'
import type { Order } from '@/lib/domain/order'
import { createOrder } from '@/lib/services/orderService'

export async function createOrderAction(id: string): Promise<Order> {
  try {
    return await createOrder({ id })
  } catch (err) {
    log.error({ err }, 'createOrderAction failed')
    throw err
  }
}
