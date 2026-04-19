import { findAllOrders } from '@/lib/db/orderRepository'
import { OrdersBoard } from './OrdersBoard'

export default async function Home() {
  const initial = await findAllOrders()
  return <OrdersBoard initial={initial} />
}
