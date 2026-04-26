'use client'

import { useMemo } from 'react'
import type { Order, OrderStatus } from '@/lib/domain/order'
import type { OrderStatusCounts } from '@/lib/db/orderRepository'
import { KanbanBoardShell } from './KanbanBoardShell'
import { KanbanColumn } from './KanbanColumn'

const KANBAN_COLUMNS: ReadonlyArray<{ name: string; status: OrderStatus }> = [
  { name: 'Drafting',   status: 'draft' },
  { name: 'Reviewing',  status: 'submitted' },
  { name: 'Fulfilling', status: 'invoiced' },
  { name: 'Archiving',  status: 'archiving' },
]

export function KanbanBoard({
  orders,
  statusCounts,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  selectedId,
  onSelect,
}: {
  orders: Order[]
  statusCounts: OrderStatusCounts | undefined
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  // One pass through orders puts each card in the bucket whose column it
  // belongs to. Terminal states (archived, deleted, cancelled, voided)
  // fall through and are intentionally not surfaced in the kanban ---
  // they remain visible in the spreadsheet, which is the audit view.
  const buckets = useMemo(() => {
    const grouped: Record<OrderStatus, Order[]> = {
      draft: [],
      submitted: [],
      invoiced: [],
      archiving: [],
      archived: [],
      discarded: [],
      cancelled: [],
      voided: [],
    }
    for (const order of orders) {
      grouped[order.status].push(order)
    }
    return grouped
  }, [orders])

  const pagination = {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  }

  return (
    <KanbanBoardShell
      columns={KANBAN_COLUMNS.map(({ name, status }, idx) => (
        <KanbanColumn
          key={status}
          name={name}
          cards={buckets[status]}
          expectedTotal={statusCounts?.[status]}
          showUnseenIndicator={idx === 0}
          selectedId={selectedId}
          onSelect={onSelect}
          {...pagination}
        />
      ))}
    />
  )
}
