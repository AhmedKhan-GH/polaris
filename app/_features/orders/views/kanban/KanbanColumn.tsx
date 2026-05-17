'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { OrderStatus } from '@/lib/domain/order'
import { useOrdersByStatus, type DateFilters } from '../../data/useOrdersByStatus'
import { useScrollAnchor } from '../../shared/useScrollAnchor'
import { KanbanCard } from './KanbanCard'
import { OrderCard } from '../../shared/OrderCard'
import { KanbanColumnShell } from './KanbanColumnShell'

const ESTIMATE_HEIGHT = 60

export function KanbanColumn({
  name,
  status,
  expectedTotal,
  selectedId,
  onSelect,
  dateFilters,
}: {
  name: string
  status: OrderStatus
  expectedTotal?: number
  selectedId: string | null
  onSelect: (id: string) => void
  dateFilters?: DateFilters
}) {
  const { cards, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrdersByStatus(status, dateFilters)
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalSlots = Math.max(cards.length, expectedTotal ?? 0)

  const virtualizer = useVirtualizer({
    count: totalSlots,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATE_HEIGHT,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 30,
  })

  const measuredHeight = useCallback(() => {
    const items = virtualizer.getVirtualItems()
    if (items.length === 0) return ESTIMATE_HEIGHT
    return items[0].size
  }, [virtualizer])

  const { unseenCount, reset: resetUnseen } = useScrollAnchor(
    scrollRef,
    totalSlots,
    measuredHeight(),
  )

  const [isAtTop, setIsAtTop] = useState(true)

  useEffect(() => {
    if (!selectedId) return
    const index = cards.findIndex((c) => c.id === selectedId)
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'center' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const atTop = el.scrollTop === 0
      setIsAtTop((prev) => (prev === atTop ? prev : atTop))
      if (atTop) resetUnseen()

      if (cards.length === 0) return
      if (!hasNextPage || isFetchingNextPage) return
      const h = measuredHeight()
      const loadedBottomPx = cards.length * h
      const distanceFromLoadedBottom =
        loadedBottomPx - el.scrollTop - el.clientHeight
      if (distanceFromLoadedBottom < h * 3) {
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
    measuredHeight,
  ])

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const el = scrollRef.current
    if (!el || cards.length === 0) return
    const h = measuredHeight()
    const loadedBottomPx = cards.length * h
    const distanceFromLoadedBottom =
      loadedBottomPx - el.scrollTop - el.clientHeight
    if (distanceFromLoadedBottom < h * 3) {
      fetchNextPage()
    }
  }, [cards.length, hasNextPage, isFetchingNextPage, fetchNextPage, measuredHeight])

  function handleUnseenClick() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    resetUnseen()
  }

  const itemTransitionClass = isAtTop
    ? 'transition-transform duration-200 ease-out motion-reduce:transition-none'
    : ''

  const headerAlert =
    unseenCount > 0 ? (
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
      status={status}
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
            if (!order) {
              return (
                <div
                  key={`shell-${vi.index}`}
                  ref={virtualizer.measureElement}
                  data-index={vi.index}
                  className="absolute left-0 right-0 pb-2"
                  style={{
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  <OrderCard loading>
                    <div className="flex flex-col gap-[2px] leading-tight">
                      <span className="block h-4 w-20 rounded bg-zinc-700" />
                      <span className="block h-3 w-36 rounded bg-zinc-700/70" />
                    </div>
                  </OrderCard>
                </div>
              )
            }
            return (
              <div
                key={order.id}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                className={`absolute left-0 right-0 pb-2 ${itemTransitionClass}`}
                style={{
                  transform: `translateY(${vi.start}px)`,
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
