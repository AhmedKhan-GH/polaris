'use client'

import { memo, useCallback } from 'react'
import { formatCreatedAt, type Order } from '@/lib/domain/order'
import { KanbanCardShell } from './KanbanCardShell'

export const KanbanCard = memo(function KanbanCard({
  order,
  isSelected,
  onSelect,
}: {
  order: Order
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const handleClick = useCallback(
    () => onSelect(order.id),
    [onSelect, order.id],
  )
  return (
    <KanbanCardShell isSelected={isSelected} onClick={handleClick}>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-mono text-sm font-medium text-zinc-50">
          {order.orderNumber}
        </span>
        <span className="truncate text-[11px] text-zinc-400">
          {formatCreatedAt(order.createdAt)}
        </span>
      </div>
    </KanbanCardShell>
  )
})
