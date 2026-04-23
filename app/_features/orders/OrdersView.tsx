'use client'

import { type Order } from '@/lib/domain/order'
import { OrdersShell } from './OrdersShell'
import { useOrders } from './useOrders'
import { KanbanBoard } from './views/kanban/KanbanBoard'

export function OrdersView({ initial }: { initial: Order[] }) {
  const { orders, isCreating, createOrder } = useOrders(initial)

  return (
    <OrdersShell
      headerAction={
        <button
          type="button"
          onClick={createOrder}
          disabled={isCreating}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-opacity hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-40"
        >
          New Order
        </button>
      }
    >
      <KanbanBoard orders={orders} />
    </OrdersShell>
  )
}
