'use client'

import { type Order } from '@/lib/domain/order'

// Locale + options pinned so server-rendered output matches the client's
// first paint --- otherwise hydration mismatches on the comma/space and
// 12h vs 24h based on the user's system.
function formatCreatedAt(date: Date): string {
  const d = new Date(date)
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${datePart} · ${timePart}`
}

export function SpreadsheetView({ orders }: { orders: Order[] }) {
  return (
    <div className="flex-1 min-h-0 overflow-auto scrollbar-thin rounded-lg border border-zinc-800 bg-zinc-900">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-400 shadow-[inset_0_-1px_0_0_rgb(39,39,42)]">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Order #
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={2}
                className="px-4 py-10 text-center text-zinc-500"
              >
                No orders yet
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="hover:bg-zinc-800/50">
                <td className="px-4 py-3 font-mono text-zinc-50">
                  {order.orderNumber}
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {formatCreatedAt(order.createdAt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
