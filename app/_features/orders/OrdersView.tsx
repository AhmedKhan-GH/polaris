'use client'

import { useSearchParams } from 'next/navigation'
import { type Order } from '@/lib/domain/order'
import { OrdersShell } from './OrdersShell'
import { useOrders } from './useOrders'
import { ViewSwitcher, type View } from './ViewSwitcher'
import { KanbanBoard } from './views/kanban/KanbanBoard'
import { SpreadsheetView } from './views/spreadsheet/SpreadsheetView'

function parseView(raw: string | null): View {
  return raw === 'spreadsheet' ? 'spreadsheet' : 'kanban'
}

export function OrdersView({ initial }: { initial: Order[] }) {
  const { orders, isCreating, createOrder } = useOrders(initial)
  const view = parseView(useSearchParams().get('view'))

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
          <ViewSwitcher current={view} />
        </div>
      }
    >
      {view === 'kanban' ? (
        <KanbanBoard orders={orders} />
      ) : (
        <SpreadsheetView orders={orders} />
      )}
    </OrdersShell>
  )
}
