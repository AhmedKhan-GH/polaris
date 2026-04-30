'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar as ShadCalendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  dedupeById,
  formatCreatedAt,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from '@/lib/domain/order'
import type {
  OrderFilters,
  OrderStatusCounts,
  OrdersCursor,
} from '@/lib/db/orderRepository'
import {
  countFilteredOrdersAction,
  countFilteredOrdersByStatusAction,
  findFilteredOrdersPageAction,
} from '../../data/actions'
import {
  ORDERS_PAGE_SIZE,
  spreadsheetOrderStatusCountsQueryKey,
  spreadsheetOrdersCountQueryKey,
  spreadsheetOrdersQueryKey,
} from '../../data/queryKeys'
import { StatusBadge } from '../../shared/StatusBadge'
import { useScrollAnchor } from '../../shared/useScrollAnchor'

const ROW_HEIGHT = 44
const GRID_COLUMNS = 'grid-cols-[120px_140px_1fr]'
const ORDER_COUNT_FORMATTER = new Intl.NumberFormat('en-US')
type SpreadsheetOrdersCache = InfiniteData<Order[], OrdersCursor | null>

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
  statusCounts,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  selectedId,
  onSelect,
}: {
  orders: Order[]
  totalCount: number
  statusCounts: OrderStatusCounts | undefined
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Multi-select status filter. Empty set = no filter (show everything).
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

  const filters = useMemo<OrderFilters>(() => {
    const next: OrderFilters = {}
    const statuses = ORDER_STATUSES.filter((status) =>
      selectedStatuses.has(status),
    )
    const createdFrom = boundToTimestamp(dateFrom, timeFrom, 'start')
    const createdTo = boundToTimestamp(dateTo, timeTo, 'end')

    if (statuses.length > 0) next.statuses = statuses
    if (createdFrom) next.createdFrom = createdFrom
    if (createdTo) next.createdTo = createdTo
    return next
  }, [
    selectedStatuses,
    dateFrom,
    timeFrom,
    dateTo,
    timeTo,
  ])

  const filtersActive =
    (filters.statuses?.length ?? 0) > 0 ||
    filters.createdFrom !== undefined ||
    filters.createdTo !== undefined
  const dateFiltersActive =
    filters.createdFrom !== undefined || filters.createdTo !== undefined
  const statusCountFilters = useMemo<OrderFilters>(() => {
    const next: OrderFilters = {}
    if (filters.createdFrom) next.createdFrom = filters.createdFrom
    if (filters.createdTo) next.createdTo = filters.createdTo
    return next
  }, [filters.createdFrom, filters.createdTo])

  const filteredPages = useInfiniteQuery<
    Order[],
    Error,
    SpreadsheetOrdersCache,
    ReturnType<typeof spreadsheetOrdersQueryKey>,
    OrdersCursor | null
  >({
    queryKey: spreadsheetOrdersQueryKey(filters),
    queryFn: ({ pageParam }) =>
      findFilteredOrdersPageAction(filters, pageParam, ORDERS_PAGE_SIZE),
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < ORDERS_PAGE_SIZE) return undefined
      const last = lastPage[lastPage.length - 1]
      return { createdAt: last.createdAt.toISOString(), id: last.id }
    },
    enabled: filtersActive,
  })

  const filteredTotal = useQuery({
    queryKey: spreadsheetOrdersCountQueryKey(filters),
    queryFn: () => countFilteredOrdersAction(filters),
    enabled: filtersActive,
  })
  const dateFilteredStatusCounts = useQuery({
    queryKey: spreadsheetOrderStatusCountsQueryKey(statusCountFilters),
    queryFn: () => countFilteredOrdersByStatusAction(statusCountFilters),
    enabled: dateFiltersActive,
  })
  const {
    data: filteredPagesData,
    hasNextPage: filteredHasNextPage,
    isFetchingNextPage: filteredIsFetchingNextPage,
    fetchNextPage: fetchNextFilteredPage,
  } = filteredPages

  const filteredOrders = useMemo(
    () => dedupeById(filteredPagesData?.pages.flat() ?? []),
    [filteredPagesData],
  )

  const visibleOrders = filtersActive ? filteredOrders : orders
  const displayCount = filtersActive
    ? Math.max(visibleOrders.length, filteredTotal.data ?? 0)
    : totalCount
  const activeHasNextPage = filtersActive ? filteredHasNextPage : hasNextPage
  const activeIsFetchingNextPage = filtersActive
    ? filteredIsFetchingNextPage
    : isFetchingNextPage
  const statusFilterCounts = dateFiltersActive
    ? dateFilteredStatusCounts.data
    : statusCounts
  const statusFilterCountsPending =
    dateFiltersActive && dateFilteredStatusCounts.data === undefined
  const fetchNextVisiblePage = useCallback(() => {
    if (filtersActive) {
      void fetchNextFilteredPage()
    } else {
      fetchNextPage()
    }
  }, [filtersActive, fetchNextFilteredPage, fetchNextPage])

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

      if (visibleOrders.length === 0) return
      if (!activeHasNextPage || activeIsFetchingNextPage) return
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
    activeHasNextPage,
    activeIsFetchingNextPage,
    fetchNextVisiblePage,
    resetUnseen,
  ])

  // Fast-scroll resilience. If the user flings past the loaded rows
  // while a fetch is in flight and then stops, shells may be visible
  // but no new scroll event arrives after the page lands. Re-run the
  // boundary check whenever loading settles or the loaded length grows
  // so pagination continues until the viewport is backed by real rows.
  useEffect(() => {
    if (!activeHasNextPage || activeIsFetchingNextPage) return
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
    activeHasNextPage,
    activeIsFetchingNextPage,
    fetchNextVisiblePage,
  ])

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
        counts={statusFilterCounts}
        countsPending={statusFilterCountsPending}
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

// Combine a date string ('yyyy-mm-dd') and a time string ('HH:MM' or
// 'HH:MM:SS', or '' / malformed -> fallback to start/end of day) into
// the timestamp shape Postgres stores in orders.created_at. Hours pad
// so half-typed '9:30' still parses; seconds are optional. `kind`
// selects the inclusive boundary: 'start' fills missing seconds with
// :00.000, 'end' fills with :59.999 so an order anywhere in the final
// minute still passes.
function boundToTimestamp(
  date: string,
  time: string,
  kind: 'start' | 'end',
): string | null {
  if (!date) return null
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  let suffix: string
  if (match) {
    const h = match[1].padStart(2, '0')
    const m = match[2]
    const s = match[3]
    if (s !== undefined) {
      suffix = kind === 'end' ? `${h}:${m}:${s}.999` : `${h}:${m}:${s}.000`
    } else {
      suffix = kind === 'end' ? `${h}:${m}:59.999` : `${h}:${m}:00.000`
    }
  } else {
    suffix = kind === 'end' ? '23:59:59.999' : '00:00:00.000'
  }
  return `${date} ${suffix}`
}

// Date field built on shadcn/ui's Calendar (popover + react-day-picker).
// Trigger button shows the ISO value or 'YYYY-MM-DD' placeholder; the
// shadcn Calendar component owns all of the visual styling so it stays
// in sync with the rest of the design system without bespoke CSS.
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
  const [open, setOpen] = useState(false)
  const empty = value === ''
  const selected = isoToLocalDate(value)
  const minDate = isoToLocalDate(min)
  const maxDate = isoToLocalDate(max)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-7 items-center gap-1.5 rounded px-1 font-mono text-sm hover:bg-zinc-800/50 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
        >
          <span className={empty ? 'text-zinc-600' : 'text-zinc-200'}>
            {empty ? 'YYYY-MM-DD' : value}
          </span>
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
            className="text-zinc-500"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <ShadCalendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate ?? maxDate ?? new Date()}
          onSelect={(d) => {
            if (d) onChange(localDateToIso(d))
            setOpen(false)
          }}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
        />
      </PopoverContent>
    </Popover>
  )
}

function isoToLocalDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return undefined
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function localDateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Plain text input for time. Native focus/blur means clicking anywhere
// else on the page blurs naturally — no edit-mode toggle, no document
// listeners. Empty state shows '--:--' as a placeholder.
function TimeField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="\d{1,2}:\d{2}(:\d{2})?"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      placeholder="HH:MM:SS"
      aria-label={ariaLabel}
      autoComplete="off"
      className="w-[75px] rounded bg-transparent px-1 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600 hover:bg-zinc-800/50 focus:ring-1 focus:ring-blue-400/40"
    />
  )
}

// Multi-select status filter rendered as a dropdown menu. The trigger
// shows a count badge when at least one status is selected so the
// active-filter state is visible without opening the menu.
function StatusFilterBar({
  selected,
  onChange,
  counts,
  countsPending,
}: {
  selected: Set<OrderStatus>
  onChange: (next: Set<OrderStatus>) => void
  counts: OrderStatusCounts | undefined
  countsPending: boolean
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
                  <span
                    aria-live="polite"
                    aria-label={`${status} count`}
                    className="ml-auto font-mono text-xs tabular-nums text-zinc-500"
                  >
                    {countsPending
                      ? '...'
                      : ORDER_COUNT_FORMATTER.format(counts?.[status] ?? 0)}
                  </span>
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
