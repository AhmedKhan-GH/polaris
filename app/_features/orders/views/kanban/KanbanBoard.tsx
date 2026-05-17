'use client'

import type { OrderStatus } from '@/lib/domain/order'
import type { OrderStatusCounts } from '@/lib/db/orderRepository'
import { KanbanBoardShell } from './KanbanBoardShell'
import { KanbanColumn } from './KanbanColumn'

const ALL_COLUMNS: ReadonlyArray<{ name: string; status: OrderStatus }> = [
  { name: 'Drafted',   status: 'drafted' },
  { name: 'Submitted', status: 'submitted' },
  { name: 'Invoiced',  status: 'invoiced' },
  { name: 'Closed',    status: 'closed' },
]

export function KanbanBoard({
  statusCounts,
  selectedId,
  onSelect,
  statuses,
}: {
  statusCounts: OrderStatusCounts | undefined
  selectedId: string | null
  onSelect: (id: string) => void
  statuses?: ReadonlyArray<OrderStatus>
}) {
  const columns = statuses
    ? ALL_COLUMNS.filter((col) => statuses.includes(col.status))
    : ALL_COLUMNS

  return (
    <KanbanBoardShell
      columns={columns.map(({ name, status }) => (
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
