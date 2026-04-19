'use server'

import { revalidatePath } from 'next/cache'
import { log } from '@/lib/log'
import { createOrder } from '@/lib/services/orderService'

export async function createOrderAction() {
  try {
    const order = await createOrder()
    revalidatePath('/')
    return { ok: true as const, orderNumber: order.orderNumber }
  } catch (err) {
    log.error({ err }, 'createOrderAction failed')
    throw err
  }
}
