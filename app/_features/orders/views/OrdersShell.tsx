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
  const handleClose = useCallback(() => setSelectedId(null), [])

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
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        )}
        {view === 'board' && (
          <KanbanBoard
            statusCounts={statusCounts}
            selectedId={selectedId}
            onSelect={handleSelect}
            statuses={statuses}
          />
        )}
        {view === 'table' && (
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
        )}
        {view !== 'detail' && (
          <OrderDetailSidebar order={selectedOrder} onClose={handleClose} />
        )}
      </div>
    </main>
  )
}
