'use client'

import { useState } from 'react'
import { OrdersShell } from './OrdersShell'
import { useOrders } from './useOrders'
import { ViewSwitcher, type View } from './ViewSwitcher'
import { KanbanBoard } from './views/kanban/KanbanBoard'
import { SpreadsheetView } from './views/spreadsheet/SpreadsheetView'

export function OrdersView() {
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
    <OrdersShell
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
      {view === 'kanban' ? (
        <KanbanBoard orders={orders} {...pagination} />
      ) : (
        <SpreadsheetView orders={orders} {...pagination} />
      )}
    </OrdersShell>
  )
}
