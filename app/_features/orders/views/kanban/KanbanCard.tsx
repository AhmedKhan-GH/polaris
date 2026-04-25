'use client'

import { memo } from 'react'
import { formatCreatedAt, type Order } from '@/lib/domain/order'
import { KanbanCardShell } from './KanbanCardShell'

export const KanbanCard = memo(function KanbanCard({
  order,
}: {
  order: Order
}) {
  return (
    <KanbanCardShell>
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-sm font-medium text-zinc-50">
          {order.orderNumber}
        </span>
        <span className="text-[11px] text-zinc-400">
          {formatCreatedAt(order.createdAt)}
        </span>
      </div>
    </KanbanCardShell>
  )
})
