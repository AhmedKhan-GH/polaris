'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  dedupeById,
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
import {
  boundToTimestamp,
  DateRangeFilter,
  type DateRangeFilterValues,
} from './DateRangeFilter'
import { SpreadsheetTable } from './SpreadsheetTable'
import { StatusFilterBar } from './StatusFilterBar'
import { STATUS_FILTER_ORDER } from './constants'

type SpreadsheetOrdersCache = InfiniteData<Order[], OrdersCursor | null>

const EMPTY_DATE_RANGE: DateRangeFilterValues = {
  dateFrom: '',
  timeFrom: '',
  dateTo: '',
  timeTo: '',
}

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
  // Empty status set = no filter (show everything).
  const [selectedStatuses, setSelectedStatuses] = useState<Set<OrderStatus>>(
    new Set(),
  )
  const [dateRange, setDateRange] =
    useState<DateRangeFilterValues>(EMPTY_DATE_RANGE)

  const filters = useMemo<OrderFilters>(() => {
    const next: OrderFilters = {}
    const statuses = STATUS_FILTER_ORDER.filter((status) =>
      selectedStatuses.has(status),
    )
    const createdFrom = boundToTimestamp(
      dateRange.dateFrom,
      dateRange.timeFrom,
      'start',
    )
    const createdTo = boundToTimestamp(
      dateRange.dateTo,
      dateRange.timeTo,
      'end',
    )

    if (statuses.length > 0) next.statuses = statuses
    if (createdFrom) next.createdFrom = createdFrom
    if (createdTo) next.createdTo = createdTo
    return next
  }, [selectedStatuses, dateRange])

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

  const filterBar = (
    <div className="flex flex-wrap items-center gap-3">
      <StatusFilterBar
        selected={selectedStatuses}
        onChange={setSelectedStatuses}
        counts={statusFilterCounts}
        countsPending={statusFilterCountsPending}
      />
      <DateRangeFilter value={dateRange} onChange={setDateRange} />
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

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {filterBar}
      <SpreadsheetTable
        visibleOrders={visibleOrders}
        displayCount={displayCount}
        hasNextPage={activeHasNextPage}
        isFetchingNextPage={activeIsFetchingNextPage}
        fetchNextPage={fetchNextVisiblePage}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}
