import { createOrder, getOrders } from '@/app/_features/orders';

import { OrdersBoardView } from './OrdersBoardView';
import { OrdersListView } from './OrdersListView';
import { OrdersStatusView } from './OrdersStatusView';
import { ViewSwitcher } from './ViewSwitcher';

/**
 * Orders console — one RLS-scoped `getOrders()` feeding three URL-driven views:
 * List, Board (a column per status), and Status (park on one status and clear
 * tickets). View + selection live in the query string (`?view`, `?selected`,
 * `?status`) — shareable and back-button-safe, no client cache. List/Board show
 * a read-only preview for the selected order and "Open" to the full `/orders/[id]`
 * page; the Status view edits in place. "New order" creates a draft and stays
 * here. Covered by the orders E2E suite (async server component).
 */
type SearchParams = {
  view?: string;
  selected?: string;
  status?: string;
  from?: string;
  to?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { view = 'list', selected, status, from, to } = await searchParams;
  const orders = await getOrders();

  async function createDraftOrder() {
    'use server';
    // Create an empty draft and STAY here — createOrder revalidates /orders, so
    // the new draft appears (newest first); open it to add lines.
    await createOrder();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <form action={createDraftOrder}>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            New order
          </button>
        </form>
      </div>

      <ViewSwitcher
        view={view}
        selected={selected}
        status={status}
        from={from}
        to={to}
      />

      {view === 'board' ? (
        <OrdersBoardView orders={orders} selected={selected} />
      ) : view === 'status' ? (
        <OrdersStatusView
          orders={orders}
          status={status ?? 'submitted'}
          selected={selected}
        />
      ) : (
        <OrdersListView
          orders={orders}
          selected={selected}
          status={status}
          from={from}
          to={to}
        />
      )}
    </div>
  );
}
