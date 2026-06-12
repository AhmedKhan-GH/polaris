'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { OrderStatus } from '@/lib/domain/order'
import type { UserRole } from '@/lib/profile'
import { useOrders } from '../data/useOrders'
import { findInCaches } from '../data/cacheHelpers'
import { usePreferences } from '../../preferences/PreferencesProvider'
import { ViewSwitcher, type View } from '../header/ViewSwitcher'
import { StatusOrdersView } from './StatusOrdersView'
import { KanbanBoard } from './kanban/KanbanBoard'
import { ListView } from './list/ListView'
import {
  boundToTimestamp,
  ListDateFilter,
  type ListDateFilterValues,
} from './list/ListDateFilter'
import { OrderDetailSidebar } from '../sidebar/OrderDetailSidebar'

const EMPTY_DATE_RANGE: ListDateFilterValues = {
  dateFrom: '',
  timeFrom: '',
  dateTo: '',
  timeTo: '',
}

export function OrdersShell({
  statuses,
  canCreate,
  role = 'owner',
  isGuest = false,
  profileId,
}: {
  statuses: readonly OrderStatus[]
  canCreate: boolean
  role?: UserRole
  isGuest?: boolean
  profileId?: string
}) {
  const [view, setView] = useState<View>('detail')

  const {
    orders,
    totalCount,
    statusCounts,
    isCreating,
    createOrder,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useOrders({ isGuest, profileId })

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
        {/* Header */}
        <header className="shrink-0 flex items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-4">
            <ViewSwitcher current={view} onChange={setView} />
          </div>
          <div className="shrink-0">
            {canCreate && (
              <button
                type="button"
                onClick={createOrder}
                disabled={isCreating}
                className="shrink-0 whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-opacity hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-40"
              >
                Draft
              </button>
            )}
          </div>
        </header>

        {view === 'detail' && (
          <StatusOrdersView
            statuses={statuses}
            statusCounts={statusCounts}
            role={role}
          />
        )}
        {view === 'board' && (
          <BoardWithSidebar
            statusCounts={statusCounts}
            statuses={statuses}
            role={role}
          />
        )}
        {view === 'list' && (
          <ListWithSidebar
            orders={orders}
            totalCount={totalCount}
            statusCounts={statusCounts}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            role={role}
          />
        )}
      </div>
    </main>
  )
}

function BoardWithSidebar({
  statusCounts,
  statuses,
  role,
}: {
  statusCounts: ReturnType<typeof useOrders>['statusCounts']
  statuses: readonly OrderStatus[]
  role: UserRole
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<ListDateFilterValues>(EMPTY_DATE_RANGE)
  const { timezone } = usePreferences()
  const queryClient = useQueryClient()

  const dateFilters = useMemo(() => {
    const createdFrom = boundToTimestamp(dateRange.dateFrom, dateRange.timeFrom, 'start', timezone)
    const createdTo = boundToTimestamp(dateRange.dateTo, dateRange.timeTo, 'end', timezone)
    const f: { createdFrom?: number; createdTo?: number } = {}
    if (createdFrom !== null) f.createdFrom = createdFrom
    if (createdTo !== null) f.createdTo = createdTo
    return Object.keys(f).length > 0 ? f : undefined
  }, [dateRange, timezone])

  const selectedOrder = selectedId
    ? findInCaches(queryClient, selectedId)
    : null

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])
  const handleClose = useCallback(() => setSelectedId(null), [])

  return (
    <>
      <div className="shrink-0">
        <ListDateFilter value={dateRange} onChange={setDateRange} />
      </div>
      <KanbanBoard
        statusCounts={statusCounts}
        selectedId={selectedId}
        onSelect={handleSelect}
        statuses={statuses}
        dateFilters={dateFilters}
      />
      <OrderDetailSidebar
        order={selectedOrder}
        onClose={handleClose}
        role={role}
        onDuplicated={(copy) => setSelectedId(copy.id)}
      />
    </>
  )
}

function ListWithSidebar({
  orders,
  totalCount,
  statusCounts,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  role,
}: {
  orders: ReturnType<typeof useOrders>['orders']
  totalCount: number
  statusCounts: ReturnType<typeof useOrders>['statusCounts']
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  role: UserRole
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const selectedOrder = selectedId
    ? findInCaches(queryClient, selectedId)
    : null

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])
  const handleClose = useCallback(() => setSelectedId(null), [])

  return (
    <>
      <ListView
        orders={orders}
        totalCount={totalCount}
        statusCounts={statusCounts}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
      <OrderDetailSidebar
        order={selectedOrder}
        onClose={handleClose}
        role={role}
        onDuplicated={(copy) => setSelectedId(copy.id)}
      />
    </>
  )
}
