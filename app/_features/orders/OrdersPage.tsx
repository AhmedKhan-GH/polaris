'use client'

import { useCallback, useState } from 'react'
import { OrderDetailSidebar } from './OrderDetailSidebar'
import { OrdersHeader } from './OrdersHeader'
import { OrdersPageShell } from './OrdersPageShell'
import { useOrders } from './useOrders'
import { type View } from './ViewSwitcher'
import { KanbanBoard } from './views/kanban/KanbanBoard'
import { SpreadsheetView } from './views/spreadsheet/SpreadsheetView'

export function OrdersPage() {
  const {
    orders,
    totalCount,
    isCreating,
    createOrder,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useOrders()
  const [view, setView] = useState<View>('kanban')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Keep stable across renders so memoized rows/cards aren't busted.
  const handleSelect = useCallback((id: string) => setSelectedId(id), [])
  const handleClose = useCallback(() => setSelectedId(null), [])

  const selectedOrder = selectedId
    ? orders.find((o) => o.id === selectedId) ?? null
    : null

  const pagination = {
    totalCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  }

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
          orders={orders}
          selectedId={selectedId}
          onSelect={handleSelect}
          {...pagination}
        />
      </div>
      <div
        className={view === 'spreadsheet' ? 'flex min-h-0 flex-1' : 'hidden'}
        aria-hidden={view !== 'spreadsheet'}
      >
        <SpreadsheetView
          orders={orders}
          selectedId={selectedId}
          onSelect={handleSelect}
          {...pagination}
        />
      </div>
      <OrderDetailSidebar order={selectedOrder} onClose={handleClose} />
    </OrdersPageShell>
  )
}
