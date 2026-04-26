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
} from '@/lib/db/orderRepository'
import { OrdersHeaderShell } from './_features/orders/OrdersHeaderShell'
import { OrdersPageShell } from './_features/orders/OrdersPageShell'
import { OrdersPage } from './_features/orders/OrdersPage'
import {
  ORDERS_COUNT_QUERY_KEY,
  ORDERS_PAGE_SIZE,
  ORDERS_QUERY_KEY,
  ORDERS_STATUS_COUNTS_QUERY_KEY,
} from './_features/orders/queryKeys'
import { KanbanBoardShell } from './_features/orders/views/kanban/KanbanBoardShell'
import { KanbanColumnShell } from './_features/orders/views/kanban/KanbanColumnShell'

const FALLBACK = (
  <OrdersPageShell
    loading
    header={<OrdersHeaderShell loading />}
  >
    <KanbanBoardShell
      columns={[
        <KanbanColumnShell key="drafting" loading name="Drafting" count="—" />,
        <KanbanColumnShell key="reviewing" loading name="Reviewing" count="—" />,
        <KanbanColumnShell key="fulfilling" loading name="Fulfilling" count="—" />,
        <KanbanColumnShell key="archiving" loading name="Archiving" count="—" />,
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
  // Prefetch the first page on the server, then hand it to the client
  // via HydrationBoundary so useInfiniteQuery picks up the cached page
  // without an extra round-trip on first paint.
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
  ])
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersPage />
    </HydrationBoundary>
  )
}
