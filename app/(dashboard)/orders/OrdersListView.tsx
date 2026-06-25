import Link from 'next/link';

import type { OrderRow } from '@/app/_features/orders';

import { OrderPreview } from './OrderPreview';
import { statusTones } from './statusTones';

/**
 * List view — the orders table (unchanged columns/test-ids). Clicking the order
 * number selects it (`?selected`) and opens the read-only preview at the side;
 * "Open" navigates to the full `/orders/[id]` page to edit.
 */
export function OrdersListView({
  orders,
  selected,
}: {
  orders: OrderRow[];
  selected?: string;
}) {
  return (
    <div className="flex gap-6">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2 pr-4 font-medium">Order</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Created by</th>
            <th className="py-2 pr-4 font-medium">Created (UTC)</th>
            <th className="py-2 pr-4 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-2 text-zinc-500">
                No orders yet.
              </td>
            </tr>
          ) : (
            orders.map((o) => (
              <tr key={o.id} data-testid="order-row">
                <td className="py-2 pr-4 font-mono">
                  <Link href={`/orders?view=list&selected=${o.id}`}>
                    #{o.orderNumber}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  <span
                    data-testid="order-status"
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTones[o.status] ?? 'bg-zinc-200 text-zinc-800'}`}
                  >
                    {o.status}
                  </span>
                </td>
                <td
                  data-testid="order-created-by"
                  className="py-2 pr-4 font-mono text-xs"
                >
                  {o.createdBy}
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

      {selected && (
        <aside
          data-testid="preview-panel"
          className="w-96 shrink-0 border-l border-zinc-200 pl-6"
        >
          <OrderPreview orderId={selected} />
        </aside>
      )}
    </div>
  );
}
