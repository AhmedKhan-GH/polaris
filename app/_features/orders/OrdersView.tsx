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
    isCreating,
    createOrder,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    pendingCount,
    revealPending,
  } = useOrders()
  const [view, setView] = useState<View>('kanban')

  const pagination = { hasNextPage, isFetchingNextPage, fetchNextPage }

  return (
    <OrdersShell
      headerAction={
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={createOrder}
              disabled={isCreating}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-opacity hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-40"
            >
              New Order
            </button>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={revealPending}
                className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
              >
                {pendingCount} new {pendingCount === 1 ? 'order' : 'orders'} · show
              </button>
            )}
          </div>
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
