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
import { StatusBadge } from '../../shared/StatusBadge'
import { useScrollAnchor } from '../../shared/useScrollAnchor'

const ROW_HEIGHT = 44
const GRID_COLUMNS = 'grid-cols-[120px_140px_1fr]'

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

  // Fast-scroll resilience. If the user flings past the loaded rows
  // while a fetch is in flight and then stops, shells may be visible
  // but no new scroll event arrives after the page lands. Re-run the
  // boundary check whenever loading settles or the loaded length grows
  // so pagination continues until the viewport is backed by real rows.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const el = scrollRef.current
    if (!el || orders.length === 0) return
    const loadedHeight = orders.length * ROW_HEIGHT
    const distanceFromLoadedBottom =
      loadedHeight - el.scrollTop - el.clientHeight
    if (distanceFromLoadedBottom < ROW_HEIGHT * 5) {
      fetchNextPage()
    }
  }, [orders.length, hasNextPage, isFetchingNextPage, fetchNextPage])

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
          scrollbar track only spans the body rows. The "↑ N new" pill
          rides inline inside the last (Created) column header with
          justify-between splitting the cell into title-on-left,
          pill-on-right --- no absolute positioning, no wrapper div,
          just two flex children of the column-header cell. */}
      {headerGroups.map((headerGroup) => (
        <div
          key={headerGroup.id}
          role="row"
          className={`grid ${GRID_COLUMNS} text-left text-xs uppercase tracking-wider text-zinc-400 shadow-[inset_0_-1px_0_0_rgb(39,39,42)]`}
        >
          {headerGroup.headers.map((header, index, arr) => {
            const isLast = index === arr.length - 1
            return (
              <div
                key={header.id}
                role="columnheader"
                className="flex min-w-0 items-center justify-between gap-2 px-4 py-3 font-semibold"
              >
                <span className="truncate">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </span>
                {isLast && unseenCount > 0 && (
                  <button
                    type="button"
                    onClick={handleUnseenClick}
                    className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-blue-300 transition-colors hover:bg-blue-500/25"
                  >
                    ↑ {unseenCount} new
                  </button>
                )}
              </div>
            )
          })}
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
            // The virtualizer reserves `totalCount` slots so the
            // scrollbar matches the true dataset. When the viewport
            // outruns the loaded rows during a fast fling, render
            // shells in the unloaded slots instead of a blank gap.
            if (!row) {
              return (
                <SpreadsheetRowShell
                  key={`shell-${vi.index}`}
                  rowIndex={vi.index}
                  start={vi.start}
                  size={vi.size}
                />
              )
            }
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
                className={`absolute left-0 right-0 grid cursor-pointer ${GRID_COLUMNS} items-center border-b border-zinc-800 ${selectionClass}`}
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

function SpreadsheetRowShell({
  rowIndex,
  start,
  size,
}: {
  rowIndex: number
  start: number
  size: number
}) {
  return (
    <div
      role="row"
      aria-hidden="true"
      aria-rowindex={rowIndex + 1}
      className={`absolute left-0 right-0 grid ${GRID_COLUMNS} items-center border-b border-zinc-800 animate-loading-card`}
      style={{
        transform: `translateY(${start}px)`,
        height: size,
      }}
    >
      <div role="cell" className="px-4 py-3">
        <span className="block h-4 w-16 rounded bg-zinc-700" />
      </div>
      <div role="cell" className="px-4 py-3">
        <span className="inline-flex h-5 w-20 items-center rounded-full border border-zinc-700 bg-zinc-800 px-2">
          <span className="block h-2 w-11 rounded-full bg-zinc-700/80" />
        </span>
      </div>
      <div role="cell" className="px-4 py-3">
        <span className="block h-4 w-36 rounded bg-zinc-700/70" />
      </div>
    </div>
  )
}
