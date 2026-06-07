import { createOrder, getOrders } from '@/app/_features/orders/actions'

export default async function OrdersPage() {
  const rows = await getOrders()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <form action={createOrder}>
          <button
            type="submit"
            className="flex h-12 items-center justify-center rounded-lg bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            New order
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p data-testid="no-orders" className="text-zinc-500">
          No orders yet.
        </p>
      ) : (
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
                <td className="py-2 pr-4 font-mono text-xs">
                  {order.createdBy}
                </td>
                <td className="py-2">
                  {new Date(order.createdAt * 1000).toISOString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
