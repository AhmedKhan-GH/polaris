import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query'
import { findOrdersPageByStatus, countOrdersByStatus } from '@/lib/db/orderRepository'
import {
  ORDERS_PAGE_SIZE,
  ORDERS_STATUS_COUNTS_QUERY_KEY,
  ordersByStatusQueryKey,
} from '../../_features/orders/data/queryKeys'
import { DraftOrdersView } from '../../_features/orders/views/drafts/DraftOrdersView'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'

export default async function DraftOrdersPage() {
  const profile = await getProfile()
  if (!profile) notFound()

  const ability = defineAbilityFor(profile.role)
  if (!ability.can('read', 'DraftOrder')) notFound()

  return (
    <Suspense fallback={<DraftOrdersLoading />}>
      <DraftOrdersData />
    </Suspense>
  )
}

function DraftOrdersLoading() {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-72 shrink-0 border-r border-zinc-800 animate-pulse" />
      <div className="flex-1" />
    </div>
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
      <DraftOrdersView />
    </HydrationBoundary>
  )
}
