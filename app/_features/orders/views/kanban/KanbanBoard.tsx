'use client'

import type { Order } from '@/lib/domain/order'
import { KanbanBoardShell } from './KanbanBoardShell'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard({
  orders,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  orders: Order[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}) {
  const pagination = { hasNextPage, isFetchingNextPage, fetchNextPage }
  return (
    <KanbanBoardShell
      columns={[
        <KanbanColumn key="drafting" name="Drafting" cards={orders} {...pagination} />,
        <KanbanColumn key="reviewing" name="Reviewing" cards={[]} {...pagination} />,
        <KanbanColumn key="fulfilling" name="Fulfilling" cards={[]} {...pagination} />,
        <KanbanColumn key="archiving" name="Archiving" cards={[]} {...pagination} />,
      ]}
    />
  )
}
