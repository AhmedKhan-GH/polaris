'use client'

import { memo } from 'react'
import type { Order } from '@/lib/domain/order'
import { OrderCardShell } from './OrderCardShell'
import { OrderCardSkeleton } from './OrderCardSkeleton'

// `pending` is a UI concern (optimistic overlay), not a domain concept,
// so it lives with the component that renders it.
export type BoardCard = Order & { pending?: boolean }

export const OrderCard = memo(function OrderCard({ order }: { order: BoardCard }) {
  if (order.pending) return <OrderCardSkeleton />
  return <OrderCardShell>{order.orderNumber}</OrderCardShell>
})
