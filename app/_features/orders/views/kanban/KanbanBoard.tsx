'use client'

import type { Order } from '@/lib/domain/order'
import { KanbanBoardShell } from './KanbanBoardShell'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard({
  orders,
  totalCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  selectedId,
  onSelect,
}: {
  orders: Order[]
  totalCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const pagination = {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  }
  return (
    <KanbanBoardShell
      columns={[
        <KanbanColumn
          key="drafting"
          name="Drafting"
          cards={orders}
          expectedTotal={totalCount}
          showUnseenIndicator
          selectedId={selectedId}
          onSelect={onSelect}
          {...pagination}
        />,
        <KanbanColumn
          key="reviewing"
          name="Reviewing"
          cards={[]}
          selectedId={selectedId}
          onSelect={onSelect}
          {...pagination}
        />,
        <KanbanColumn
          key="fulfilling"
          name="Fulfilling"
          cards={[]}
          selectedId={selectedId}
          onSelect={onSelect}
          {...pagination}
        />,
        <KanbanColumn
          key="archiving"
          name="Archiving"
          cards={[]}
          selectedId={selectedId}
          onSelect={onSelect}
          {...pagination}
        />,
      ]}
    />
  )
}
