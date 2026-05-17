import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query'
import {
  findOrdersPageByStatus,
  findDraftsByCreator,
  countOrdersByStatus,
  countDraftsByCreator,
} from '@/lib/db/orderRepository'
import { ORDER_STATUSES } from '@/lib/domain/order'
import type { OrderStatusCounts } from '@/lib/db/orderRepository'
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
  const profile = (await getProfile())!
  const isGuest = profile.role === 'guest'
  const queryClient = new QueryClient()
  await Promise.all([
    queryClient.prefetchInfiniteQuery({
      queryKey: ordersByStatusQueryKey('drafted'),
      queryFn: () =>
        isGuest
          ? findDraftsByCreator(profile.id, null, ORDERS_PAGE_SIZE)
          : findOrdersPageByStatus('drafted', null, ORDERS_PAGE_SIZE),
      initialPageParam: null,
    }),
    queryClient.prefetchQuery({
      queryKey: ORDERS_STATUS_COUNTS_QUERY_KEY,
      queryFn: async () => {
        if (isGuest) {
          const n = await countDraftsByCreator(profile.id)
          const zeros = Object.fromEntries(
            ORDER_STATUSES.map((s) => [s, 0]),
          ) as OrderStatusCounts
          zeros.drafted = n
          return zeros
        }
        return countOrdersByStatus()
      },
    }),
  ])
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DraftOrdersView />
    </HydrationBoundary>
  )
}
