'use client'

import { useOrderLineItemRows } from '../data/useOrderLineItemRows'
import {
  formatItemCount,
  formatMoney,
  getLineItemSummary,
} from './summary'

export function OrderLineItemStats({ orderId }: { orderId: string }) {
  const { lineItems, isLoading } = useOrderLineItemRows(orderId, {
    subscribe: false,
  })
  const summary = getLineItemSummary(lineItems)
  const total =
    summary.pricedCount === 0 && summary.count > 0
      ? null
      : summary.totalCost

  return (
    <div
      aria-label="Order line item summary"
      className="flex shrink-0 items-center gap-2 text-xs text-zinc-400"
    >
      <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono tabular-nums">
        {isLoading ? '-' : formatItemCount(summary.count)}
      </span>
      <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono tabular-nums text-zinc-300">
        {isLoading ? '-' : formatMoney(total)}
      </span>
    </div>
  )
}
