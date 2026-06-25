import Link from 'next/link';

import { groupOrdersByStatus, type OrderRow } from '@/app/_features/orders';

import { OrderPreview } from './OrderPreview';

/**
 * Board view — one column per status (canonical order via groupOrdersByStatus),
 * orders as cards. Clicking a card selects it (`?selected`) → read-only preview
 * at the side; "Open" (in the preview) → full page to edit. Drag-to-transition
 * is a later enhancement (it would call transitionOrder).
 */
export function OrdersBoardView({
  orders,
  selected,
}: {
  orders: OrderRow[];
  selected?: string;
}) {
  const grouped = groupOrdersByStatus(orders);

  return (
    <div className="flex gap-6">
      <div className="flex flex-1 gap-4 overflow-x-auto" data-testid="board">
        {Object.entries(grouped).map(([status, list]) => (
          <div
            key={status}
            data-testid="board-column"
            data-status={status}
            className="w-56 shrink-0"
          >
            <h3 className="mb-2 flex items-center justify-between text-sm font-medium capitalize">
              {status}
              <span className="text-xs text-zinc-400">{list.length}</span>
            </h3>
            <div className="flex flex-col gap-2">
              {list.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders?view=board&selected=${o.id}`}
                  data-testid="order-card"
                  aria-current={o.id === selected ? 'true' : undefined}
                  className={`rounded border p-2 text-sm font-mono ${
                    o.id === selected
                      ? 'border-zinc-900'
                      : 'border-zinc-200'
                  }`}
                >
                  #{o.orderNumber}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

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
