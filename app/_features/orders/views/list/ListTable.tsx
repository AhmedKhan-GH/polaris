'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  formatCreatedAt,
  type Order,
} from '@/lib/domain/order'
import { usePreferences } from '../../../preferences/PreferencesProvider'
import { StatusBadge } from '../../shared/StatusBadge'
import { useScrollAnchor } from '../../shared/useScrollAnchor'
import { GRID_COLUMNS, ROW_HEIGHT } from './constants'
import { ListRowShell } from './ListRowShell'

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

export function ListTable({
  visibleOrders,
  displayCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  scrollResetKey,
  selectedId,
  onSelect,
}: {
  visibleOrders: Order[]
  displayCount: number
  hasNextPage: boolean | undefined
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  scrollResetKey: string
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { timezone, hour12 } = usePreferences()

  const columns = useMemo(
    () => [
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
        cell: (info) => formatCreatedAt(info.getValue(), timezone, hour12),
        meta: { cellClassName: 'text-zinc-300' },
      }),
    ],
    [timezone, hour12],
  )

  const table = useReactTable({
    data: visibleOrders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const virtualizer = useVirtualizer({
    count: displayCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  const { unseenCount, reset: resetUnseen } = useScrollAnchor(
    scrollRef,
    displayCount,
    ROW_HEIGHT,
  )

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop !== 0) {
      el.scrollTo({ top: 0 })
    }
    resetUnseen()
  }, [scrollResetKey, resetUnseen])

  const fetchNextVisiblePage = useCallback(() => {
    fetchNextPage()
  }, [fetchNextPage])

  // Scroll-driven pagination: fetch the next page only when the user has
  // actually scrolled near the bottom of the loaded rows. A purely
  // structural check would trip immediately whenever the viewport could
  // render more rows than are loaded.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (el.scrollTop === 0) resetUnseen()

      if (visibleOrders.length === 0) return
      if (!hasNextPage || isFetchingNextPage) return
      const loadedHeight = visibleOrders.length * ROW_HEIGHT
      const distanceFromLoadedBottom =
        loadedHeight - el.scrollTop - el.clientHeight
      if (distanceFromLoadedBottom < ROW_HEIGHT * 5) {
        fetchNextVisiblePage()
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [
    visibleOrders.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextVisiblePage,
    resetUnseen,
  ])

  // Fast-scroll resilience. If the user flings past the loaded rows
  // while a fetch is in flight and then stops, shells may be visible
  // but no new scroll event arrives after the page lands. Re-run the
  // boundary check whenever loading settles or the loaded length grows
  // so pagination continues until the viewport is backed by real rows.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const el = scrollRef.current
    if (!el || visibleOrders.length === 0) return
    const loadedHeight = visibleOrders.length * ROW_HEIGHT
    const distanceFromLoadedBottom =
      loadedHeight - el.scrollTop - el.clientHeight
    if (distanceFromLoadedBottom < ROW_HEIGHT * 5) {
      fetchNextVisiblePage()
    }
  }, [
    visibleOrders.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextVisiblePage,
  ])

  function handleUnseenClick() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    resetUnseen()
  }

  const headerGroups = table.getHeaderGroups()
  const rows = table.getRowModel().rows
  const items = virtualizer.getVirtualItems()
  const totalSize = displayCount * ROW_HEIGHT

  return (
    <div
      role="table"
      aria-rowcount={displayCount}
      className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
    >
      {/* Header sits outside the scroll container so the vertical
          scrollbar track only spans the body rows. The "↑ N new" pill
          rides inline inside the last (Created) column header with
          justify-between splitting the cell into title-on-left,
          pill-on-right. */}
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
            if (!row) {
              return (
                <ListRowShell
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
