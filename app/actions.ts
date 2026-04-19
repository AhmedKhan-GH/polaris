'use server'

import { log } from '@/lib/log'
import { createOrder } from '@/lib/services/orderService'

export async function createOrderAction() {
  try {
    const order = await createOrder()
    return { ok: true as const, orderNumber: order.orderNumber }
  } catch (err) {
    log.error({ err }, 'createOrderAction failed')
    throw err
  }
}
