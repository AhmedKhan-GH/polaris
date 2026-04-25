'use client'

import { useState } from 'react'
import { OrdersPageShell } from './OrdersPageShell'
import { useOrders } from './useOrders'
import { ViewSwitcher, type View } from './ViewSwitcher'
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
      headerAction={
        <div className="flex flex-1 items-center justify-between">
          <button
            type="button"
            onClick={createOrder}
            disabled={isCreating}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-opacity hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-40"
          >
            New Order
          </button>
          <ViewSwitcher current={view} onChange={setView} />
        </div>
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
