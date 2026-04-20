'use client'

import { OrderCard, type BoardCard } from './OrderCard'

export function OrderColumn({
  name,
  cards,
}: {
  name: string
  cards: BoardCard[]
}) {
  return (
    <section className="flex w-64 shrink-0 min-h-0 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          {name}
        </h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
          {cards.length}
        </span>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {cards.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </ul>
    </section>
  )
}
