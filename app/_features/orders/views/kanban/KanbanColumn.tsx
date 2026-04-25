'use client'

import type { Order } from '@/lib/domain/order'
import { KanbanCard } from './KanbanCard'
import { KanbanColumnShell } from './KanbanColumnShell'

export function KanbanColumn({
  name,
  cards,
}: {
  name: string
  cards: Order[]
}) {
  return (
    <KanbanColumnShell name={name} count={cards.length}>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {cards.map((order) => (
          <KanbanCard key={order.id} order={order} />
        ))}
      </ul>
    </KanbanColumnShell>
  )
}
