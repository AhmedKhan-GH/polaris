import Link from 'next/link';

import { filterOrders, type OrderRow } from '@/app/_features/orders';
import { formatTimestamp } from '@/lib/datetime';

import { ListFilters } from './ListFilters';
import { OrderPreview } from './OrderPreview';
import { statusTones } from './statusTones';

/**
 * List view — a filter bar (status + created-date range) over the orders table.
 * Clicking the order number selects it (`?selected`, preserving the active
 * filter) and opens the read-only preview at the side; "Open" navigates to the
 * full `/orders/[id]` page to edit.
 */
export function OrdersListView({
  orders,
  selected,
  status,
  from,
  to,
  timezone,
  hour12,
}: {
  orders: OrderRow[];
  selected?: string;
  status?: string;
  from?: string;
  to?: string;
  timezone: string;
  hour12: boolean;
}) {
  const filtered = filterOrders(orders, { status, from, to });
  const isFiltered = Boolean(status || from || to);

  const selectHref = (id: string) => {
    const p = new URLSearchParams({ view: 'list', selected: id });
    if (status) p.set('status', status);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return `/orders?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <ListFilters status={status} from={from} to={to} />

      <div className="flex gap-6">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-4 font-medium">Order</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Created by</th>
              <th className="py-2 pr-4 font-medium">Created</th>
              <th className="py-2 pr-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2 text-zinc-500">
                  {isFiltered ? 'No orders match these filters.' : 'No orders yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id} data-testid="order-row">
                  <td className="py-2 pr-4 font-mono">
                    <Link href={selectHref(o.id)}>#{o.orderNumber}</Link>
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
                  <td className="py-2 pr-4">
                    {formatTimestamp(o.createdAt.getTime(), timezone, hour12)}
                  </td>
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
    </div>
  );
}
