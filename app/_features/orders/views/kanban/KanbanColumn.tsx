'use client'

import type { Order } from '@/lib/domain/order'
import { useLoadMoreRef } from '../../useLoadMoreRef'
import { KanbanCard } from './KanbanCard'
import { KanbanColumnShell } from './KanbanColumnShell'

export function KanbanColumn({
  name,
  cards,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  name: string
  cards: Order[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}) {
  const loadMoreRef = useLoadMoreRef({
    enabled: hasNextPage && !isFetchingNextPage,
    onLoadMore: fetchNextPage,
  })

  return (
    <KanbanColumnShell name={name} count={cards.length}>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {cards.map((order) => (
          <KanbanCard key={order.id} order={order} />
        ))}
        {/* Only attach a sentinel in columns that have content. Otherwise
            an empty column would have its sentinel always intersecting
            the viewport and would fire fetchNextPage on every render. */}
        {cards.length > 0 && hasNextPage && (
          <li ref={loadMoreRef} aria-hidden className="h-px shrink-0" />
        )}
        {cards.length > 0 && isFetchingNextPage && (
          <li className="shrink-0 py-1 text-center text-xs text-zinc-500">
            Loading more…
          </li>
        )}
      </ul>
    </KanbanColumnShell>
  )
}
