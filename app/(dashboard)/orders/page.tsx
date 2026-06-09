import { createOrder, getOrders } from '@/app/_features/orders/actions'
import { getSessionUser } from '@/lib/auth/session'
import { OrdersLive } from '@/app/_features/orders/OrdersLive'

export default async function OrdersPage() {
  const session = await getSessionUser()
  const rows = (await getOrders()).map((o) => ({
    id: o.id,
    createdBy: o.createdBy,
    createdAt: o.createdAt.toISOString(),
  }))

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

      <OrdersLive userId={session!.userId} initial={rows} />
    </div>
  )
}
