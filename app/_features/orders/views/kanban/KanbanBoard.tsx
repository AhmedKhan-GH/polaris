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
}: {
  orders: Order[]
  totalCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}) {
  const pagination = { hasNextPage, isFetchingNextPage, fetchNextPage }
  // Until a status field exists, every order belongs to Drafting. The
  // expected total drives the virtualizer's spacer for that column so the
  // scroll bar doesn't shrink as pages stream in. Other columns omit it
  // and behave as plain empty columns.
  return (
    <KanbanBoardShell
      columns={[
        <KanbanColumn
          key="drafting"
          name="Drafting"
          cards={orders}
          expectedTotal={totalCount}
          {...pagination}
        />,
        <KanbanColumn key="reviewing" name="Reviewing" cards={[]} {...pagination} />,
        <KanbanColumn key="fulfilling" name="Fulfilling" cards={[]} {...pagination} />,
        <KanbanColumn key="archiving" name="Archiving" cards={[]} {...pagination} />,
      ]}
    />
  )
}
