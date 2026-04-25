'use client'

import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type Order } from '@/lib/domain/order'

const ROW_HEIGHT = 44

// Locale + options pinned so server-rendered output matches the client's
// first paint --- otherwise hydration mismatches on the comma/space and
// 12h vs 24h based on the user's system.
function formatCreatedAt(date: Date): string {
  const d = new Date(date)
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${datePart} · ${timePart}`
}

export function SpreadsheetView({
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
  const scrollRef = useRef<HTMLDivElement>(null)

  // Virtualizer is sized to the FULL row count, not just what's loaded ---
  // this keeps the scroll bar stable as pages stream in. Indices beyond
  // orders.length render as placeholders until their page arrives.
  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  const items = virtualizer.getVirtualItems()
  // Compute the spacer height manually instead of relying on
  // virtualizer.getTotalSize(), which can return a stale value on first
  // render before the measurement cache initializes. Static estimateSize
  // means total = totalCount × ROW_HEIGHT exactly.
  const totalSize = totalCount * ROW_HEIGHT
  const lastIndex = items.length > 0 ? items[items.length - 1].index : -1

  // When the user scrolls into the placeholder zone (or simply when the
  // viewport doesn't fit all loaded rows), pull the next page.
  useEffect(() => {
    if (lastIndex < 0) return
    if (
      lastIndex >= orders.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [lastIndex, orders.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (totalCount === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500">
        No orders yet
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      role="table"
      aria-rowcount={totalCount}
      className="flex-1 min-h-0 overflow-auto scrollbar-thin rounded-lg border border-zinc-800 bg-zinc-900"
    >
      <div
        role="row"
        className="sticky top-0 z-10 grid grid-cols-2 bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-400 shadow-[inset_0_-1px_0_0_rgb(39,39,42)]"
      >
        <div role="columnheader" className="px-4 py-3 font-semibold">
          Order #
        </div>
        <div role="columnheader" className="px-4 py-3 font-semibold">
          Created
        </div>
      </div>

      <div
        role="rowgroup"
        className="relative"
        style={{ height: totalSize }}
      >
        {items.map((vi) => {
          const order = orders[vi.index]
          if (!order) {
            return (
              <div
                key={`placeholder-${vi.index}`}
                role="row"
                aria-rowindex={vi.index + 1}
                aria-hidden
                className="absolute left-0 right-0 grid grid-cols-2 border-b border-zinc-800 transition-transform duration-200 ease-out motion-reduce:transition-none"
                style={{
                  transform: `translateY(${vi.start}px)`,
                  height: vi.size,
                }}
              >
                <div role="cell" className="px-4 py-3">
                  <div className="h-3 w-16 rounded bg-zinc-800" />
                </div>
                <div role="cell" className="px-4 py-3">
                  <div className="h-3 w-32 rounded bg-zinc-800" />
                </div>
              </div>
            )
          }
          return (
            <div
              key={order.id}
              role="row"
              aria-rowindex={vi.index + 1}
              className="absolute left-0 right-0 grid grid-cols-2 border-b border-zinc-800 transition-transform duration-200 ease-out hover:bg-zinc-800/50 motion-reduce:transition-none"
              style={{
                transform: `translateY(${vi.start}px)`,
                height: vi.size,
              }}
            >
              <div role="cell" className="px-4 py-3 font-mono text-zinc-50">
                {order.orderNumber}
              </div>
              <div role="cell" className="px-4 py-3 text-zinc-300">
                {formatCreatedAt(order.createdAt)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
