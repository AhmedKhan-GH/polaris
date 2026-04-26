'use client'

import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Order } from '@/lib/domain/order'
import { useScrollAnchor } from '../../useScrollAnchor'
import { KanbanCard } from './KanbanCard'
import { KanbanColumnShell } from './KanbanColumnShell'

// Card now has two text lines (order number + datetime subtitle).
// ~52px card + 8px gap below = 60px slot. KanbanCard renders top-
// aligned in its slot; the trailing space is the inter-card gap.
const SLOT_HEIGHT = 60

export function KanbanColumn({
  name,
  cards,
  expectedTotal,
  showUnseenIndicator = false,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  selectedId,
  onSelect,
}: {
  name: string
  cards: Order[]
  expectedTotal?: number
  showUnseenIndicator?: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalSlots = Math.max(cards.length, expectedTotal ?? 0)

  const virtualizer = useVirtualizer({
    count: totalSlots,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => SLOT_HEIGHT,
    overscan: 6,
  })

  const { unseenCount, reset: resetUnseen } = useScrollAnchor(
    scrollRef,
    totalSlots,
    SLOT_HEIGHT,
  )

  const [isAtTop, setIsAtTop] = useState(true)

  const items = virtualizer.getVirtualItems()
  const totalSize = totalSlots * SLOT_HEIGHT

  // The virtualizer reserves space for `totalSlots` (per-status DB
  // count) so the scrollbar reflects the full set even though only
  // `cards.length` slots have data. Pagination should fire when the
  // user scrolls within reach of the *loaded* boundary (cards.length *
  // SLOT_HEIGHT), NOT the full scroll bottom --- otherwise the user has
  // to scroll past every empty slot to load more.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const atTop = el.scrollTop === 0
      setIsAtTop((prev) => (prev === atTop ? prev : atTop))
      if (atTop) resetUnseen()

      if (cards.length === 0) return
      if (!hasNextPage || isFetchingNextPage) return
      const loadedBottomPx = cards.length * SLOT_HEIGHT
      const distanceFromLoadedBottom =
        loadedBottomPx - el.scrollTop - el.clientHeight
      if (distanceFromLoadedBottom < SLOT_HEIGHT * 3) {
        fetchNextPage()
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [
    cards.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    resetUnseen,
  ])

  function handleUnseenClick() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    resetUnseen()
  }

  const itemTransitionClass = isAtTop
    ? 'transition-transform duration-200 ease-out motion-reduce:transition-none'
    : ''

  const headerAlert =
    showUnseenIndicator && unseenCount > 0 ? (
      <button
        type="button"
        onClick={handleUnseenClick}
        className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-300 transition-colors hover:bg-blue-500/25"
      >
        ↑ {unseenCount} new
      </button>
    ) : undefined

  return (
    <KanbanColumnShell
      name={name}
      count={totalSlots}
      headerAlert={headerAlert}
    >
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
      >
        <div
          className="relative w-full"
          style={{ height: totalSize }}
        >
          {items.map((vi) => {
            const order = cards[vi.index]
            if (!order) return null
            return (
              <div
                key={order.id}
                className={`absolute left-0 right-0 ${itemTransitionClass}`}
                style={{
                  transform: `translateY(${vi.start}px)`,
                  height: vi.size,
                }}
              >
                <KanbanCard
                  order={order}
                  isSelected={order.id === selectedId}
                  onSelect={onSelect}
                />
              </div>
            )
          })}
        </div>
      </div>
    </KanbanColumnShell>
  )
}
