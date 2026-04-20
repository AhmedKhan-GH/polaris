import { Suspense } from 'react'
import { findAllOrders } from '@/lib/db/orderRepository'
import { OrderBoardSkeleton } from './_features/orders/OrderBoardSkeleton'
import { OrderBoard } from './_features/orders/OrderBoard'

export default function Home() {
  return (
    <Suspense fallback={<OrderBoardSkeleton />}>
      <OrderBoardData />
    </Suspense>
  )
}

async function OrderBoardData() {
  const initial = await findAllOrders()
  return <OrderBoard initial={initial} />
}
