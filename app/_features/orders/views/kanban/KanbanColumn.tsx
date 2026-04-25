'use client'

import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Order } from '@/lib/domain/order'
import { useScrollAnchor } from '../../useScrollAnchor'
import { KanbanCard } from './KanbanCard'
import { KanbanColumnShell } from './KanbanColumnShell'

const SLOT_HEIGHT = 44

export function KanbanColumn({
  name,
  cards,
  expectedTotal,
  showUnseenIndicator = false,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  name: string
  cards: Order[]
  expectedTotal?: number
  showUnseenIndicator?: boolean
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

  const { unseenCount, reset: resetUnseen } = useScrollAnchor(
    scrollRef,
    totalSlots,
    SLOT_HEIGHT,
  )

  const [isAtTop, setIsAtTop] = useState(true)

  const items = virtualizer.getVirtualItems()
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

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const atTop = el.scrollTop === 0
      setIsAtTop((prev) => (prev === atTop ? prev : atTop))
      if (atTop) resetUnseen()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [resetUnseen])

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
                <KanbanCard order={order} />
              </div>
            )
          })}
        </div>
      </div>
    </KanbanColumnShell>
  )
}
