'use server'

import { revalidatePath } from 'next/cache'
import { createOrder } from '@/lib/services/orderService'

export async function createOrderAction() {
  await createOrder()
  revalidatePath('/')
}
