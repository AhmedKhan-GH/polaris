import { Suspense } from 'react'
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query'
import {
  countOrders,
  countOrdersByStatus,
  findOrdersPage,
  findOrdersPageByStatus,
} from '@/lib/db/orderRepository'
import type { OrderStatus } from '@/lib/domain/order'
import { OrdersHeaderShell } from './_features/orders/header/OrdersHeaderShell'
import { OrdersPageShell } from './_features/orders/OrdersPageShell'
import { OrdersPage } from './_features/orders/OrdersPage'
import {
  ORDERS_COUNT_QUERY_KEY,
  ORDERS_PAGE_SIZE,
  ORDERS_QUERY_KEY,
  ORDERS_STATUS_COUNTS_QUERY_KEY,
  ordersByStatusQueryKey,
} from './_features/orders/data/queryKeys'
import { KanbanBoardShell } from './_features/orders/views/kanban/KanbanBoardShell'
import { KanbanColumnShell } from './_features/orders/views/kanban/KanbanColumnShell'

// Statuses surfaced by the kanban (terminal states stay in the
// spreadsheet only). Each gets its own prefetch so columns paint with
// real cards on first load instead of waiting for realtime to fill in.
const KANBAN_STATUSES: ReadonlyArray<OrderStatus> = [
  'drafted',
  'submitted',
  'invoiced',
  'completed',
]

const FALLBACK = (
  <OrdersPageShell
    loading
    header={<OrdersHeaderShell loading />}
  >
    <KanbanBoardShell
      columns={[
        <KanbanColumnShell key="drafted"   loading name="Drafted"   count="—" />,
        <KanbanColumnShell key="submitted" loading name="Submitted" count="—" />,
        <KanbanColumnShell key="invoiced"  loading name="Invoiced"  count="—" />,
        <KanbanColumnShell key="completed" loading name="Completed" count="—" />,
      ]}
    />
  </OrdersPageShell>
)

export default function Home() {
  return (
    <Suspense fallback={FALLBACK}>
      <OrdersPageData />
    </Suspense>
  )
}

async function OrdersPageData() {
  // Prefetch every cache the client will need on first paint so
  // useInfiniteQuery / useQuery hydrate without an extra round-trip:
  // the spreadsheet's global page, the count + per-status aggregates,
  // and the first page of each kanban column.
  const queryClient = new QueryClient()
  await Promise.all([
    queryClient.prefetchInfiniteQuery({
      queryKey: ORDERS_QUERY_KEY,
      queryFn: () => findOrdersPage(null, ORDERS_PAGE_SIZE),
      initialPageParam: null,
    }),
    queryClient.prefetchQuery({
      queryKey: ORDERS_COUNT_QUERY_KEY,
      queryFn: () => countOrders(),
    }),
    queryClient.prefetchQuery({
      queryKey: ORDERS_STATUS_COUNTS_QUERY_KEY,
      queryFn: () => countOrdersByStatus(),
    }),
    ...KANBAN_STATUSES.map((status) =>
      queryClient.prefetchInfiniteQuery({
        queryKey: ordersByStatusQueryKey(status),
        queryFn: () => findOrdersPageByStatus(status, null, ORDERS_PAGE_SIZE),
        initialPageParam: null,
      }),
    ),
  ])
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersPage />
    </HydrationBoundary>
  )
}
