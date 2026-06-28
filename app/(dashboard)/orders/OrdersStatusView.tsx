import Link from 'next/link';

import {
  ORDER_STATUSES,
  groupOrdersByStatus,
  type OrderRow,
  type OrderStatus,
} from '@/app/_features/orders';

import { OrderDetail } from './OrderDetail';
import { statusTones } from './statusTones';

/**
 * Status work view — the "park on one status and clear tickets" mode. A status
 * picker + a scrollable rail of just that status's orders on the left; the
 * selected order opens EDITABLE in the panel on the right (the same OrderDetail
 * as the full page, mounted in place — not a navigation). Transitioning an order
 * revalidates /orders, so it drops out of the rail and you move to the next.
 */
export function OrdersStatusView({
  orders,
  status,
  selected,
}: {
  orders: OrderRow[];
  status: string;
  selected?: string;
}) {
  const grouped = groupOrdersByStatus(orders);
  const current: OrderStatus = ORDER_STATUSES.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : 'submitted';
  const rail = grouped[current];

  return (
    <div className="flex gap-6">
      <div className="flex w-64 shrink-0 flex-col gap-3" data-testid="status-rail">
        <div className="flex flex-wrap gap-1">
          {ORDER_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/orders?view=status&status=${s}`}
              aria-current={s === current ? 'page' : undefined}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                s === current
                  ? statusTones[s]
                  : 'border border-zinc-200 text-zinc-500'
              }`}
            >
              {s}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto">
          {rail.length === 0 ? (
            <p className="text-sm text-zinc-500">No {current} orders.</p>
          ) : (
            rail.map((o) => (
              <Link
                key={o.id}
                href={`/orders?view=status&status=${current}&selected=${o.id}`}
                data-testid="status-card"
                aria-current={o.id === selected ? 'true' : undefined}
                className={`rounded border p-2 text-sm font-mono ${
                  o.id === selected ? 'border-zinc-900' : 'border-zinc-200'
                }`}
              >
                #{o.orderNumber}
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="flex-1" data-testid="status-detail">
        {selected ? (
          <OrderDetail orderId={selected} />
        ) : (
          <p className="text-sm text-zinc-500">
            Pick an order from the rail to work on it here.
          </p>
        )}
      </div>
    </div>
  );
}
