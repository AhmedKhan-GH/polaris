'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { OrderStatus } from '@/lib/domain/order'
import { useOrders } from '../data/useOrders'
import { findInCaches } from '../data/cacheHelpers'
import { ViewSwitcher, type View } from '../header/ViewSwitcher'
import { StatusOrdersView } from './StatusOrdersView'
import { KanbanBoard } from './kanban/KanbanBoard'
import { ListView } from './list/ListView'
import { OrderDetailSidebar } from '../sidebar/OrderDetailSidebar'

export function OrdersShell({
  statuses,
  canCreate,
}: {
  statuses: readonly OrderStatus[]
  canCreate: boolean
}) {
  const [view, setView] = useState<View>('detail')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const {
    orders,
    totalCount,
    statusCounts,
    isCreating,
    createOrder,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useOrders()

  const selectedOrder = selectedId
    ? findInCaches(queryClient, selectedId)
    : null

  const handleSelect = useCallback((id: string) => setSelectedId(id), [])
  const handleCloseSidebar = useCallback(() => setSelectedId(null), [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header bar with view switcher and create button */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
        <ViewSwitcher current={view} onChange={setView} />
        <div className="flex-1" />
        {canCreate && view !== 'detail' && (
          <button
            type="button"
            disabled={isCreating}
            onClick={createOrder}
            className="rounded bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
          >
            New
          </button>
        )}
      </div>

      {/* View content */}
      {view === 'detail' && (
        <StatusOrdersView statuses={statuses} canCreate={canCreate} />
      )}

      {view === 'board' && (
        <div className="flex min-h-0 flex-1">
          <KanbanBoard
            statusCounts={statusCounts}
            selectedId={selectedId}
            onSelect={handleSelect}
            statuses={statuses}
          />
          <OrderDetailSidebar
            order={selectedOrder}
            onClose={handleCloseSidebar}
          />
        </div>
      )}

      {view === 'table' && (
        <div className="relative flex min-h-0 flex-1 p-4">
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
            onClose={handleCloseSidebar}
          />
        </div>
      )}
    </div>
  )
}
