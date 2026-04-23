import { Suspense } from 'react'
import { findAllOrders } from '@/lib/db/orderRepository'
import { OrdersView } from './_features/orders/OrdersView'
import { OrdersViewSkeleton } from './_features/orders/OrdersViewSkeleton'

export default function Home() {
  return (
    <Suspense fallback={<OrdersViewSkeleton />}>
      <OrdersViewData />
    </Suspense>
  )
}

async function OrdersViewData() {
  const initial = await findAllOrders()
  return <OrdersView initial={initial} />
}
