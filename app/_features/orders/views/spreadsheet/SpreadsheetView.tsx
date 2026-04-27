'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  formatCreatedAt,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from '@/lib/domain/order'
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

  // Multi-select status filter. Empty set = no filter (show everything).
  // Filtering is client-side over the loaded orders window: pagination
  // continues against the unfiltered server count, so as more pages
  // arrive the filtered list grows naturally without a query rewrite.
  const [selectedStatuses, setSelectedStatuses] = useState<Set<OrderStatus>>(
    new Set(),
  )
  // Date+time range filter on createdAt. Date drives the calendar, time
  // is a compact optional companion: blank time on the From bound falls
  // back to start-of-day (00:00:00) and blank on the To bound falls back
  // to end-of-day (23:59:59.999), so quick "any time on this day" filters
  // are zero-typing while exact moments stay one type away.
  const [dateFrom, setDateFrom] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeTo, setTimeTo] = useState('')

  const filtersActive =
    selectedStatuses.size > 0 || dateFrom !== '' || dateTo !== ''

  const filteredOrders = useMemo(() => {
    if (!filtersActive) return orders
    const fromMs = boundToMs(dateFrom, timeFrom, 'start')
    const toMs = boundToMs(dateTo, timeTo, 'end')
    return orders.filter((o) => {
      if (selectedStatuses.size > 0 && !selectedStatuses.has(o.status)) {
        return false
      }
      if (fromMs !== null || toMs !== null) {
        const t = o.createdAt.getTime()
        if (fromMs !== null && t < fromMs) return false
        if (toMs !== null && t > toMs) return false
      }
      return true
    })
  }, [
    orders,
    selectedStatuses,
    dateFrom,
    timeFrom,
    dateTo,
    timeTo,
    filtersActive,
  ])

  // When filtering, the displayed count is the filtered length (every
  // slot is backed by a real loaded row, no shells). When not filtering,
  // we keep the server total so the virtualizer can render shells in
  // unloaded slots as before.
  const displayCount = filtersActive ? filteredOrders.length : totalCount

  const table = useReactTable({
    data: filteredOrders,
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

  const items = virtualizer.getVirtualItems()
  // Fixed slot height (cells already truncate to one line) so vi.start
  // values are predictable for accurate scroll-anchor compensation when
  // rows are prepended.
  const totalSize = displayCount * ROW_HEIGHT

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

  // Any of the four fields counts as "set" for the purpose of the reset
  // affordance — an orphan time without a date is still a value the user
  // entered and may want to wipe in one click.
  const dateRangeActive =
    dateFrom !== '' || timeFrom !== '' || dateTo !== '' || timeTo !== ''
  const filterBar = (
    <div className="flex flex-wrap items-center gap-3">
      <StatusFilterBar
        selected={selectedStatuses}
        onChange={setSelectedStatuses}
      />
      <div className="flex h-9 flex-wrap items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 [color-scheme:dark]">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          From
        </span>
        <DateField
          value={dateFrom}
          onChange={setDateFrom}
          max={dateTo || undefined}
          ariaLabel="Created from date"
        />
        <TimeField
          value={timeFrom}
          onChange={setTimeFrom}
          ariaLabel="Created from time (defaults to 00:00 when blank)"
        />
        <span aria-hidden className="text-zinc-500">→</span>
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          To
        </span>
        <DateField
          value={dateTo}
          onChange={setDateTo}
          min={dateFrom || undefined}
          ariaLabel="Created to date"
        />
        <TimeField
          value={timeTo}
          onChange={setTimeTo}
          ariaLabel="Created to time (defaults to 23:59 when blank)"
        />
        <button
          type="button"
          disabled={!dateRangeActive}
          onClick={() => {
            setDateFrom('')
            setTimeFrom('')
            setDateTo('')
            setTimeTo('')
          }}
          aria-label="Reset date range to unspecified (show all orders)"
          title={
            dateRangeActive
              ? 'Reset date range to unspecified'
              : 'Date range is unspecified — showing all orders'
          }
          className="ml-1 inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-200"
        >
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <span>Reset</span>
        </button>
      </div>
    </div>
  )

  if (totalCount === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {filterBar}
        <div className="flex-1 min-h-0 flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500">
          No orders yet
        </div>
      </div>
    )
  }

  const headerGroups = table.getHeaderGroups()
  const rows = table.getRowModel().rows

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {filterBar}
      <div
        role="table"
        aria-rowcount={displayCount}
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
  // No items-center on the grid: cells stretch to the full row height so
  // the per-cell `flex items-center` actually has room to vertically
  // center the explicit-height placeholder spans (h-4 / h-5) at the row's
  // optical midline, instead of sitting them at the top of a content-sized
  // cell (which read as "a bit low" against the line-box characters in
  // real rows).
  return (
    <div
      role="row"
      aria-hidden="true"
      aria-rowindex={rowIndex + 1}
      className={`absolute left-0 right-0 grid ${GRID_COLUMNS} border-b border-zinc-800 animate-loading-card`}
      style={{
        transform: `translateY(${start}px)`,
        height: size,
      }}
    >
      <div role="cell" className="flex items-center px-4">
        <span className="block h-4 w-16 rounded bg-zinc-700" />
      </div>
      <div role="cell" className="flex items-center px-4">
        <span className="inline-flex h-5 w-20 items-center rounded-full border border-zinc-700 bg-zinc-800 px-2">
          <span className="block h-2 w-11 rounded-full bg-zinc-700/80" />
        </span>
      </div>
      <div role="cell" className="flex items-center px-4">
        <span className="block h-4 w-36 rounded bg-zinc-700/70" />
      </div>
    </div>
  )
}

// Internal 'yyyy-mm-dd' state is the same shape as the displayed label
// (military / ISO format) — keep it as-is so empty 'yyyy-mm-dd'
// placeholder and filled '2026-04-19' value occupy identical 10-char
// monospace slots.
function formatDateDisplay(iso: string): string {
  return iso
}

// Today's date in 'yyyy-mm-dd' (local) — used as a click-to-fill default
// for empty date inputs so a user who just wants "today onward" can
// engage the filter in a single click.
function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Current local time in 'hh:mm' — click-to-fill default for empty time
// inputs.
function nowLocal(): string {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// Combine a date string ('yyyy-mm-dd') and a time string ('hh:mm', or
// '' / malformed → fallback to start/end of day) into a millisecond
// timestamp. The hour digits are padded so half-typed values like '9:30'
// still parse cleanly. `kind` selects the inclusive boundary: 'start'
// uses :00 seconds, 'end' uses :59.999 so an order at any second of the
// final minute still passes.
function boundToMs(
  date: string,
  time: string,
  kind: 'start' | 'end',
): number | null {
  if (!date) return null
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  let suffix: string
  if (match) {
    const h = match[1].padStart(2, '0')
    const m = match[2]
    suffix = kind === 'end' ? `${h}:${m}:59.999` : `${h}:${m}:00`
  } else {
    suffix = kind === 'end' ? '23:59:59.999' : '00:00:00'
  }
  const ms = new Date(`${date}T${suffix}`).getTime()
  return Number.isFinite(ms) ? ms : null
}

// Custom-rendered date field. The visible UI is a plain button that owns
// the typography, width, and placeholder rendering; the actual <input
// type="date"> sits behind it (opacity 0, pointer-events none) purely as
// a hook for the browser's native calendar picker. We open the picker
// via showPicker() on click, with a flushSync so the state-update for
// the click-to-fill default lands before the picker reads `value`. This
// makes the empty and filled widths byte-identical (both render through
// the same monospace span) and removes every cross-browser "mm/dd/yyyy"
// vs "01/15/2024" sizing surprise.
function DateField({
  value,
  onChange,
  ariaLabel,
  min,
  max,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
  min?: string
  max?: string
}) {
  const hiddenRef = useRef<HTMLInputElement>(null)

  function handleClick() {
    if (!value) {
      flushSync(() => onChange(todayLocal()))
    }
    try {
      hiddenRef.current?.showPicker()
    } catch {
      // showPicker requires a user gesture and a non-disabled input —
      // both true here. The catch is just defensive against older
      // engines where showPicker isn't implemented.
      hiddenRef.current?.focus()
      hiddenRef.current?.click()
    }
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        className="w-[100px] rounded px-1 text-left font-mono text-sm hover:bg-zinc-800/50 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
      >
        <span className={value ? 'text-zinc-200' : 'text-zinc-600'}>
          {value ? formatDateDisplay(value) : 'yyyy-mm-dd'}
        </span>
      </button>
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        tabIndex={-1}
        aria-hidden
        autoComplete="off"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </span>
  )
}

// Custom-rendered time field paralleling DateField. Default state is a
// button rendering either the value or '--:--' through the same
// monospace span — empty and filled occupy the same horizontal slot
// down to the pixel. On click the button swaps to a text input prefilled
// with the current time (or the existing value) and the contents are
// auto-selected so a fresh keystroke replaces them. Blur or Enter exits
// edit mode and restores the button display.
function TimeField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEditing() {
    if (!value) {
      flushSync(() => onChange(nowLocal()))
    }
    setEditing(true)
  }

  // Auto-select once the input mounts so the user can immediately
  // overtype without manually clearing.
  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  // Native blur only fires when focus actually transfers away. A click on
  // a non-focusable element (e.g. plain text in the filter bar or a
  // status badge) does not transfer focus, so the input would otherwise
  // stay in edit mode indefinitely. Bind a document-level listener while
  // editing to force-exit on outside mousedown / Escape.
  useEffect(() => {
    if (!editing) return
    function onMouseDown(e: MouseEvent) {
      if (!inputRef.current?.contains(e.target as Node)) {
        setEditing(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditing(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="\d{1,2}:\d{2}"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        aria-label={ariaLabel}
        autoComplete="off"
        className="w-[55px] rounded px-1 text-left font-mono text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-400/40"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label={ariaLabel}
      className="w-[55px] rounded px-1 text-left font-mono text-sm hover:bg-zinc-800/50 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
    >
      <span className={value ? 'text-zinc-200' : 'text-zinc-600'}>
        {value || '--:--'}
      </span>
    </button>
  )
}

// Multi-select status filter rendered as a dropdown menu. The trigger
// shows a count badge when at least one status is selected so the
// active-filter state is visible without opening the menu. Filtering is
// purely client-side over the loaded rows; the kanban view keeps its own
// per-column streams and is unaffected.
function StatusFilterBar({
  selected,
  onChange,
}: {
  selected: Set<OrderStatus>
  onChange: (next: Set<OrderStatus>) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const someSelected = selected.size > 0

  // Close on outside click or Escape. Bound only while the menu is open
  // so we don't pay listener cost on every render of every spreadsheet
  // mount.
  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle(status: OrderStatus) {
    const next = new Set(selected)
    if (next.has(status)) {
      next.delete(status)
    } else {
      next.add(status)
    }
    onChange(next)
  }

  return (
    <div ref={containerRef} className="relative inline-block self-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
      >
        <span>Status</span>
        {someSelected && (
          <span className="rounded-full bg-blue-500/20 px-1.5 text-[10px] font-medium leading-4 text-blue-300">
            {selected.size}
          </span>
        )}
        <span aria-hidden className="text-xs opacity-60">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-lg"
        >
          <div className="flex flex-col gap-1">
            {ORDER_STATUSES.map((status) => {
              const active = selected.has(status)
              return (
                <label
                  key={status}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 select-none hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(status)}
                    className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 accent-blue-500"
                  />
                  <StatusBadge status={status} />
                </label>
              )
            })}
          </div>
          {someSelected && (
            <>
              <div className="my-1 border-t border-zinc-800" />
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="w-full rounded px-2 py-1 text-left text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

