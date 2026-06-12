'use client'

import { useOrderLineItemRows } from '../data/useOrderLineItemRows'
import {
  formatItemCount,
  formatMoney,
  formatQuantity,
  getLineItemSummary,
  getLineItemTotal,
} from './summary'

export function LineItemSummary({ orderId }: { orderId: string }) {
  const { lineItems, isLoading, error } = useOrderLineItemRows(orderId)
  const summary = getLineItemSummary(lineItems)
  const total =
    summary.pricedCount === 0 && summary.count > 0
      ? null
      : summary.totalCost

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">Line items</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono tabular-nums text-zinc-500">
            {formatItemCount(summary.count)}
          </span>
          <span className="font-mono tabular-nums text-zinc-300">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error.message}
        </p>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-600">
          Loading line items
        </div>
      ) : lineItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-600">
          No line items
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          <div className="divide-y divide-zinc-800">
            {lineItems.map((lineItem) => (
              <div key={lineItem.id} className="px-3 py-2">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-xs font-medium text-zinc-100">
                        {lineItem.skuNumber}
                      </span>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                        #{lineItem.lineNumber}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-zinc-400">
                      {lineItem.skuName}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs tabular-nums text-zinc-200">
                      {formatQuantity(lineItem.quantity)} {lineItem.unit}
                    </div>
                    <div className="mt-1 font-mono text-xs tabular-nums text-zinc-500">
                      {formatMoney(getLineItemTotal(lineItem))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
