import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createOrder, getOrders } from '@/app/_features/orders';

/**
 * The orders list — an all-authed-users surface (the nav entry is ungated).
 * `getOrders` is RLS-scoped: a rep sees only their own orders, an owner sees all.
 * "New order" creates an empty draft and opens it (the inline server action
 * creates via the feature's dev-API, then redirects to the detail page). The
 * render is covered by the orders E2E suite, a recorded deviation, rather than a
 * unit test for this async server component.
 */
export default async function OrdersPage() {
  const orders = await getOrders();

  async function createAndOpen() {
    'use server';
    const id = await createOrder();
    redirect(`/orders/${id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <form action={createAndOpen}>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            New order
          </button>
        </form>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2 pr-4 font-medium">Order</th>
            <th className="py-2 pr-4 font-medium">Created (UTC)</th>
            <th className="py-2 pr-4 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-2 text-zinc-500">
                No orders yet.
              </td>
            </tr>
          ) : (
            orders.map((o) => (
              <tr key={o.id} data-testid="order-row">
                <td className="py-2 pr-4 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="py-2 pr-4">{o.createdAt.toISOString()}</td>
                <td className="py-2 pr-4">
                  <Link href={`/orders/${o.id}`} className="text-blue-700 underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
