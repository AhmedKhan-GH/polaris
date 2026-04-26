'use client'

import type { OrderStatus } from '@/lib/domain/order'
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
  statusCounts,
  selectedId,
  onSelect,
}: {
  statusCounts: OrderStatusCounts | undefined
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  // Each column owns its own per-status infinite query (see
  // useOrdersByStatus). Buckets and pagination live inside the
  // column, so this board is a thin shell over the per-column views.
  return (
    <KanbanBoardShell
      columns={KANBAN_COLUMNS.map(({ name, status }) => (
        <KanbanColumn
          key={status}
          name={name}
          status={status}
          expectedTotal={statusCounts?.[status]}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    />
  )
}
