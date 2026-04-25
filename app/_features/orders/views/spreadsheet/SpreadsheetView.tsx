'use client'

import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { formatCreatedAt, type Order } from '@/lib/domain/order'
import { useScrollAnchor } from '../../useScrollAnchor'

const ROW_HEIGHT = 44

// Per-column meta: className applied to the <div role="cell"> wrapper
// so each column can carry its own typography/colors without nesting
// extra spans inside every cell.
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    cellClassName?: string
  }
}

const columnHelper = createColumnHelper<Order>()

const columns = [
  columnHelper.accessor('orderNumber', {
    header: 'Order #',
    cell: (info) => info.getValue(),
    meta: { cellClassName: 'font-mono text-zinc-50' },
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created',
    cell: (info) => formatCreatedAt(info.getValue()),
    meta: { cellClassName: 'text-zinc-300' },
  }),
]

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

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  useScrollAnchor(scrollRef, totalCount, ROW_HEIGHT)

  const [isAtTop, setIsAtTop] = useState(true)

  const items = virtualizer.getVirtualItems()
  const totalSize = totalCount * ROW_HEIGHT
  const lastIndex = items.length > 0 ? items[items.length - 1].index : -1

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

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const atTop = el.scrollTop === 0
      setIsAtTop((prev) => (prev === atTop ? prev : atTop))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  if (totalCount === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500">
        No orders yet
      </div>
    )
  }

  const headerGroups = table.getHeaderGroups()
  const rows = table.getRowModel().rows

  return (
    <div
      role="table"
      aria-rowcount={totalCount}
      className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
    >
      {/* Header sits outside the scroll container so the vertical
          scrollbar track only spans the body rows --- it can't run
          alongside the header band the way it would inside a sticky
          layout. */}
      {headerGroups.map((headerGroup) => (
        <div
          key={headerGroup.id}
          role="row"
          className="grid grid-cols-2 text-left text-xs uppercase tracking-wider text-zinc-400 shadow-[inset_0_-1px_0_0_rgb(39,39,42)]"
        >
          {headerGroup.headers.map((header) => (
            <div
              key={header.id}
              role="columnheader"
              className="px-4 py-3 font-semibold"
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
            </div>
          ))}
        </div>
      ))}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto scrollbar-thin"
      >
        <div
          role="rowgroup"
          className="relative"
          style={{ height: totalSize }}
        >
        {items.map((vi) => {
          const row = rows[vi.index]
          if (!row) return null
          const transitionClass = isAtTop
            ? 'transition-transform duration-200 ease-out motion-reduce:transition-none'
            : ''
          return (
            <div
              key={row.id}
              role="row"
              aria-rowindex={vi.index + 1}
              className={`absolute left-0 right-0 grid grid-cols-2 border-b border-zinc-800 hover:bg-zinc-800/50 ${transitionClass}`}
              style={{
                transform: `translateY(${vi.start}px)`,
                height: vi.size,
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <div
                  key={cell.id}
                  role="cell"
                  className={`px-4 py-3 ${cell.column.columnDef.meta?.cellClassName ?? ''}`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
