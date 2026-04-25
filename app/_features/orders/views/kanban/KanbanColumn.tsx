'use client'

import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Order } from '@/lib/domain/order'
import { KanbanCard } from './KanbanCard'
import { KanbanColumnShell } from './KanbanColumnShell'

// Card height ~36px + 8px gap below = 44px slot. KanbanCard renders top-
// aligned in its slot, leaving the trailing 8px as the inter-card gap.
const SLOT_HEIGHT = 44

export function KanbanColumn({
  name,
  cards,
  expectedTotal,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  name: string
  cards: Order[]
  // Total rows that belong in this column even if not yet loaded. When
  // larger than `cards.length`, the virtualizer reserves space (and shows
  // placeholders) for the unloaded tail so the scroll bar doesn't grow as
  // pages stream in. Empty / unscoped columns omit this prop.
  expectedTotal?: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalSlots = Math.max(cards.length, expectedTotal ?? 0)

  const virtualizer = useVirtualizer({
    count: totalSlots,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => SLOT_HEIGHT,
    overscan: 6,
  })

  const items = virtualizer.getVirtualItems()
  // Compute the spacer height manually instead of relying on
  // virtualizer.getTotalSize(), which can return a stale value on first
  // render before the measurement cache initializes. Static estimateSize
  // means total = totalSlots × SLOT_HEIGHT exactly.
  const totalSize = totalSlots * SLOT_HEIGHT
  const lastIndex = items.length > 0 ? items[items.length - 1].index : -1

  useEffect(() => {
    if (cards.length === 0) return
    if (lastIndex < 0) return
    if (
      lastIndex >= cards.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [lastIndex, cards.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <KanbanColumnShell name={name} count={totalSlots}>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
      >
        <div
          className="relative w-full"
          style={{ height: totalSize }}
        >
          {items.map((vi) => {
            const order = cards[vi.index]
            if (!order) {
              return (
                <div
                  key={`placeholder-${vi.index}`}
                  aria-hidden
                  className="absolute left-0 right-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
                  style={{
                    transform: `translateY(${vi.start}px)`,
                    height: vi.size,
                  }}
                >
                  <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 h-9" />
                </div>
              )
            }
            return (
              <div
                key={order.id}
                className="absolute left-0 right-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
                style={{
                  transform: `translateY(${vi.start}px)`,
                  height: vi.size,
                }}
              >
                <KanbanCard order={order} />
              </div>
            )
          })}
        </div>
      </div>
    </KanbanColumnShell>
  )
}
