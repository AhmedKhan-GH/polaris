'use client'

import type { OrderStatus } from '@/lib/domain/order'
import type { OrderStatusCounts } from '@/lib/db/orderRepository'
import type { DateFilters } from '../../data/useOrdersByStatus'
import { KanbanBoardShell } from './KanbanBoardShell'
import { KanbanColumn } from './KanbanColumn'

const ALL_COLUMNS: ReadonlyArray<{ name: string; status: OrderStatus }> = [
  { name: 'Draft',      status: 'draft' },
  { name: 'Confirmed',  status: 'confirmed' },
  { name: 'Processing', status: 'processing' },
  { name: 'Fulfilled',  status: 'fulfilled' },
]

export function KanbanBoard({
  statusCounts,
  selectedId,
  onSelect,
  statuses,
  dateFilters,
}: {
  statusCounts: OrderStatusCounts | undefined
  selectedId: string | null
  onSelect: (id: string) => void
  statuses?: ReadonlyArray<OrderStatus>
  dateFilters?: DateFilters
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
          dateFilters={dateFilters}
        />
      ))}
    />
  )
}
