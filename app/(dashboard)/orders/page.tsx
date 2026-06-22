import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createOrder, getOrders } from '@/app/_features/orders';

/**
 * Orders list — an all-authed surface (the nav entry is ungated). `getOrders` is
 * RLS-scoped: a member sees only their own, owner/admin see all. "New order"
 * creates an empty draft and opens it. Covered by the orders E2E suite (a
 * recorded deviation) rather than a unit test for this async server component.
 */
const statusChip: Record<string, string> = {
  draft: 'bg-zinc-200 text-zinc-800',
  submitted: 'bg-blue-100 text-blue-800',
  processing: 'bg-amber-100 text-amber-900',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

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
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Created (UTC)</th>
            <th className="py-2 pr-4 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-2 text-zinc-500">
                No orders yet.
              </td>
            </tr>
          ) : (
            orders.map((o) => (
              <tr key={o.id} data-testid="order-row">
                <td className="py-2 pr-4 font-mono">#{o.orderNumber}</td>
                <td className="py-2 pr-4">
                  <span
                    data-testid="order-status"
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusChip[o.status] ?? 'bg-zinc-200 text-zinc-800'}`}
                  >
                    {o.status}
                  </span>
                </td>
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
