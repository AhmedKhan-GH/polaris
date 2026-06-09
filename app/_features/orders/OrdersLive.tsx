'use client'

import { useOrdersRealtime, type OrderRow } from './useOrdersRealtime'

// Client island: renders the orders table seeded with server-fetched rows and
// merges live INSERTs from the user's private realtime topic.
export function OrdersLive({
  userId,
  initial,
}: {
  userId: string
  initial: OrderRow[]
}) {
  const rows = useOrdersRealtime(userId, initial)

  if (rows.length === 0) {
    return (
      <p data-testid="no-orders" className="text-zinc-500">
        No orders yet.
      </p>
    )
  }

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-black/[.08] dark:border-white/[.145]">
          <th className="py-2 pr-4 font-medium">Order</th>
          <th className="py-2 pr-4 font-medium">Created by</th>
          <th className="py-2 font-medium">When (UTC)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((order) => (
          <tr
            key={order.id}
            data-testid="order-row"
            className="border-b border-black/[.04] dark:border-white/[.08]"
          >
            <td className="py-2 pr-4 font-mono text-xs">{order.id}</td>
            <td className="py-2 pr-4 font-mono text-xs">{order.createdBy}</td>
            <td className="py-2">{order.createdAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
