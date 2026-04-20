'use client'

import { OrderCard, type BoardCard } from './OrderCard'
import { OrderColumnShell } from './OrderColumnShell'

export function OrderColumn({
  name,
  cards,
}: {
  name: string
  cards: BoardCard[]
}) {
  return (
    <OrderColumnShell name={name} count={cards.length}>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {cards.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </ul>
    </OrderColumnShell>
  )
}
