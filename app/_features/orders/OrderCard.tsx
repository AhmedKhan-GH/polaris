'use client'

import { memo } from 'react'
import type { Order } from '@/lib/domain/order'

// `pending` is a UI concern (optimistic overlay), not a domain concept,
// so it lives with the component that renders it.
export type BoardCard = Order & { pending?: boolean }

export const OrderCard = memo(function OrderCard({ order }: { order: BoardCard }) {
  return (
    <li className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm font-medium text-zinc-50">
      {order.pending ? (
        <span
          aria-hidden
          className="inline-block h-4 w-14 rounded bg-zinc-700 animate-pulse align-middle"
        />
      ) : (
        order.orderNumber
      )}
    </li>
  )
})
