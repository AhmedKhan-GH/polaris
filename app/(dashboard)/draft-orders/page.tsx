import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query'
import { findOrdersPageByStatus, countOrdersByStatus } from '@/lib/db/orderRepository'
import { OrdersHeaderShell } from '../../_features/orders/header/OrdersHeaderShell'
import { OrdersPageShell } from '../../_features/orders/OrdersPageShell'
import { OrdersPage } from '../../_features/orders/OrdersPage'
import {
  ORDERS_PAGE_SIZE,
  ORDERS_STATUS_COUNTS_QUERY_KEY,
  ordersByStatusQueryKey,
} from '../../_features/orders/data/queryKeys'
import { KanbanBoardShell } from '../../_features/orders/views/kanban/KanbanBoardShell'
import { KanbanColumnShell } from '../../_features/orders/views/kanban/KanbanColumnShell'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'

const FALLBACK = (
  <OrdersPageShell loading header={<OrdersHeaderShell loading />}>
    <KanbanBoardShell
      columns={[
        <KanbanColumnShell key="drafted" loading name="Drafted" status="drafted" count="—" />,
      ]}
    />
  </OrdersPageShell>
)

export default async function DraftOrdersPage() {
  const profile = await getProfile()
  if (!profile) notFound()

  const ability = defineAbilityFor(profile.role)
  if (!ability.can('read', 'DraftOrder')) notFound()

  return (
    <Suspense fallback={FALLBACK}>
      <DraftOrdersData />
    </Suspense>
  )
}

async function DraftOrdersData() {
  const queryClient = new QueryClient()
  await Promise.all([
    queryClient.prefetchInfiniteQuery({
      queryKey: ordersByStatusQueryKey('drafted'),
      queryFn: () => findOrdersPageByStatus('drafted', null, ORDERS_PAGE_SIZE),
      initialPageParam: null,
    }),
    queryClient.prefetchQuery({
      queryKey: ORDERS_STATUS_COUNTS_QUERY_KEY,
      queryFn: () => countOrdersByStatus(),
    }),
  ])
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersPage statuses={['drafted']} sidebarMode="draft" />
    </HydrationBoundary>
  )
}
