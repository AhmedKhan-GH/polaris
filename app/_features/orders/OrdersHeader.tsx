'use client'

import { ViewSwitcher, type View } from './ViewSwitcher'
import { OrdersHeaderShell } from './OrdersHeaderShell'

interface OrdersHeaderProps {
  currentView: View
  isCreating: boolean
  onCreateOrder: () => void
  onViewChange: (next: View) => void
}

export function OrdersHeader({
  currentView,
  isCreating,
  onCreateOrder,
  onViewChange,
}: OrdersHeaderProps) {
  return (
    <OrdersHeaderShell
      primaryAction={
        <button
          type="button"
          onClick={onCreateOrder}
          disabled={isCreating}
          className="shrink-0 whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-opacity hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-40"
        >
          New Order
        </button>
      }
      secondaryAction={
        <ViewSwitcher current={currentView} onChange={onViewChange} />
      }
    />
  )
}
