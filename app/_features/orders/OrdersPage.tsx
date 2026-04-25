'use client'

import { useState } from 'react'
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
        <KanbanBoard orders={orders} {...pagination} />
      </div>
      <div
        className={view === 'spreadsheet' ? 'flex min-h-0 flex-1' : 'hidden'}
        aria-hidden={view !== 'spreadsheet'}
      >
        <SpreadsheetView orders={orders} {...pagination} />
      </div>
    </OrdersPageShell>
  )
}
