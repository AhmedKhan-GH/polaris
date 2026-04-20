'use client'

import { memo } from 'react'
import type { Order } from '@/lib/domain/order'
import { OrderCardSkeleton } from './OrderCardSkeleton'

// `pending` is a UI concern (optimistic overlay), not a domain concept,
// so it lives with the component that renders it.
export type BoardCard = Order & { pending?: boolean }

export const OrderCard = memo(function OrderCard({ order }: { order: BoardCard }) {
  if (order.pending) return <OrderCardSkeleton />
  return (
    <li className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm font-medium text-zinc-50">
      {order.orderNumber}
    </li>
  )
})
