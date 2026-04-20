import { Suspense } from 'react'
import { findAllOrders } from '@/lib/db/orderRepository'
import { BoardSkeleton } from './BoardSkeleton'
import { OrdersBoard } from './OrdersBoard'

export default function Home() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardData />
    </Suspense>
  )
}

async function BoardData() {
  const initial = await findAllOrders()
  return <OrdersBoard initial={initial} />
}
