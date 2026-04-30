'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { OrderDetailSidebar } from './sidebar/OrderDetailSidebar'
import { OrdersHeader } from './header/OrdersHeader'
import { OrdersPageShell } from './OrdersPageShell'
import { useOrders } from './data/useOrders'
import { findInCaches } from './data/cacheHelpers'
import { type View } from './header/ViewSwitcher'
import { KanbanBoard } from './views/kanban/KanbanBoard'
import { SpreadsheetView } from './views/spreadsheet/SpreadsheetView'

export function OrdersPage() {
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
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>('kanban')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Keep stable across renders so memoized rows/cards aren't busted.
  const handleSelect = useCallback((id: string) => setSelectedId(id), [])
  const handleClose = useCallback(() => setSelectedId(null), [])

  // The selected order may live in a per-status (kanban) cache that the
  // global query hasn't paged into yet, so we walk every cache instead
  // of just the spreadsheet's flat array.
  const selectedOrder = selectedId
    ? findInCaches(queryClient, selectedId)
    : null

  return (
    <OrdersPageShell
      header={
        <OrdersHeader
          currentView={view}
          isCreating={isCreating}
          onCreateOrder={createOrder}
          onViewChange={setView}
        />
      }
    >
      <div
        className={view === 'kanban' ? 'flex min-h-0 flex-1' : 'hidden'}
        aria-hidden={view !== 'kanban'}
      >
        <KanbanBoard
          statusCounts={statusCounts}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>
      <div
        className={view === 'spreadsheet' ? 'flex min-h-0 flex-1' : 'hidden'}
        aria-hidden={view !== 'spreadsheet'}
      >
        <SpreadsheetView
          orders={orders}
          totalCount={totalCount}
          statusCounts={statusCounts}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>
      <OrderDetailSidebar order={selectedOrder} onClose={handleClose} />
    </OrdersPageShell>
  )
}
