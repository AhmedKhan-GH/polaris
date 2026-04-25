import { Suspense } from 'react'
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query'
import { findOrdersPage } from '@/lib/db/orderRepository'
import { OrdersShell } from './_features/orders/OrdersShell'
import { OrdersView } from './_features/orders/OrdersView'
import {
  ORDERS_PAGE_SIZE,
  ORDERS_QUERY_KEY,
} from './_features/orders/ordersQuery'
import { KanbanBoardShell } from './_features/orders/views/kanban/KanbanBoardShell'
import { KanbanColumnShell } from './_features/orders/views/kanban/KanbanColumnShell'

const FALLBACK = (
  <OrdersShell
    loading
    headerAction={
      <div
        aria-hidden
        className="h-8 w-[86px] rounded-md bg-zinc-700 animate-loading-card"
      />
    }
  >
    <KanbanBoardShell
      columns={[
        <KanbanColumnShell key="drafting" loading name="Drafting" count="—" />,
        <KanbanColumnShell key="reviewing" loading name="Reviewing" count="—" />,
        <KanbanColumnShell key="fulfilling" loading name="Fulfilling" count="—" />,
        <KanbanColumnShell key="archiving" loading name="Archiving" count="—" />,
      ]}
    />
  </OrdersShell>
)

export default function Home() {
  return (
    <Suspense fallback={FALLBACK}>
      <OrdersViewData />
    </Suspense>
  )
}

async function OrdersViewData() {
  // Prefetch the first page on the server, then hand it to the client
  // via HydrationBoundary so useInfiniteQuery picks up the cached page
  // without an extra round-trip on first paint.
  const queryClient = new QueryClient()
  await queryClient.prefetchInfiniteQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: () => findOrdersPage(null, ORDERS_PAGE_SIZE),
    initialPageParam: null,
  })
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersView />
    </HydrationBoundary>
  )
}
