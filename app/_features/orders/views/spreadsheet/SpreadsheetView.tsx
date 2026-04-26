'use client'

import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { formatCreatedAt, type Order } from '@/lib/domain/order'
import { StatusBadge } from '../../StatusBadge'
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
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
    meta: { cellClassName: 'text-zinc-300' },
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
  selectedId,
  onSelect,
}: {
  orders: Order[]
  totalCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  selectedId: string | null
  onSelect: (id: string) => void
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

  const { unseenCount, reset: resetUnseen } = useScrollAnchor(
    scrollRef,
    totalCount,
    ROW_HEIGHT,
  )

  const items = virtualizer.getVirtualItems()
  // Fixed slot height (cells already truncate to one line) so vi.start
  // values are predictable for accurate scroll-anchor compensation when
  // rows are prepended.
  const totalSize = totalCount * ROW_HEIGHT

  // Scroll-driven pagination: fetch the next page only when the user has
  // actually scrolled near the bottom of the loaded rows. A purely
  // structural check would trip immediately whenever the viewport could
  // render more rows than are loaded.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (el.scrollTop === 0) resetUnseen()

      if (orders.length === 0) return
      if (!hasNextPage || isFetchingNextPage) return
      const loadedHeight = orders.length * ROW_HEIGHT
      const distanceFromLoadedBottom =
        loadedHeight - el.scrollTop - el.clientHeight
      if (distanceFromLoadedBottom < ROW_HEIGHT * 5) {
        fetchNextPage()
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [orders.length, hasNextPage, isFetchingNextPage, fetchNextPage, resetUnseen])

  function handleUnseenClick() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    resetUnseen()
  }

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
          layout. The "↑ N new" pill is tucked beside the first column
          (Order #) when rows have arrived while the user was scrolled
          away; clicking jumps back and resets the counter. */}
      {headerGroups.map((headerGroup) => (
        <div
          key={headerGroup.id}
          role="row"
          className="grid grid-cols-[120px_140px_1fr] text-left text-xs uppercase tracking-wider text-zinc-400 shadow-[inset_0_-1px_0_0_rgb(39,39,42)]"
        >
          {headerGroup.headers.map((header, index) => (
            <div
              key={header.id}
              role="columnheader"
              className="flex min-w-0 items-center gap-2 px-4 py-3 font-semibold"
            >
              <span className="truncate">
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </span>
              {index === 0 && unseenCount > 0 && (
                <button
                  type="button"
                  onClick={handleUnseenClick}
                  className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-blue-300 transition-colors hover:bg-blue-500/25"
                >
                  ↑ {unseenCount} new
                </button>
              )}
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
          const isSelected = row.original.id === selectedId
          const selectionClass = isSelected
            ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-400/40'
            : 'hover:bg-zinc-800/50'
          return (
            <div
              key={row.id}
              role="row"
              aria-rowindex={vi.index + 1}
              aria-selected={isSelected}
              tabIndex={0}
              onClick={() => onSelect(row.original.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(row.original.id)
                }
              }}
              className={`absolute left-0 right-0 grid cursor-pointer grid-cols-[120px_140px_1fr] border-b border-zinc-800 ${selectionClass}`}
              style={{
                transform: `translateY(${vi.start}px)`,
                height: vi.size,
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <div
                  key={cell.id}
                  role="cell"
                  className={`truncate px-4 py-3 ${cell.column.columnDef.meta?.cellClassName ?? ''}`}
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
