import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query'
import {
  countOrdersByStatus,
  countDraftsByCreator,
  findOrdersPageByStatus,
  findDraftsByCreator,
} from '@/lib/db/orderRepository'
import { ACTIVE_ORDER_STATUSES, ORDER_STATUSES, type OrderStatus } from '@/lib/domain/order'
import type { OrderStatusCounts } from '@/lib/db/orderRepository'
import {
  ORDERS_PAGE_SIZE,
  ORDERS_STATUS_COUNTS_QUERY_KEY,
  ordersByStatusQueryKey,
} from '../../_features/orders/data/queryKeys'
import { StatusOrdersView } from '../../_features/orders/views/StatusOrdersView'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'

const GUEST_STATUSES: readonly OrderStatus[] = ['drafted', 'submitted']

export default async function OrdersPage() {
  const profile = await getProfile()
  if (!profile) notFound()

  const ability = defineAbilityFor(profile.role)
  if (!ability.can('read', 'Order') && !ability.can('read', 'DraftOrder')) {
    notFound()
  }

  const isGuest = profile.role === 'guest'
  const statuses = isGuest ? GUEST_STATUSES : ACTIVE_ORDER_STATUSES

  return (
    <Suspense fallback={<OrdersLoading />}>
      <OrdersData profileId={profile.id} isGuest={isGuest} statuses={statuses} />
    </Suspense>
  )
}

function OrdersLoading() {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex flex-col border-b border-zinc-800 px-4 py-2">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  )
}

async function OrdersData({
  profileId,
  isGuest,
  statuses,
}: {
  profileId: string
  isGuest: boolean
  statuses: readonly OrderStatus[]
}) {
  const queryClient = new QueryClient()

  await Promise.all([
    // Prefetch the first page of each visible status tab
    ...statuses.map((status) =>
      queryClient.prefetchInfiniteQuery({
        queryKey: ordersByStatusQueryKey(status),
        queryFn: () =>
          isGuest && status === 'drafted'
            ? findDraftsByCreator(profileId, null, ORDERS_PAGE_SIZE)
            : findOrdersPageByStatus(status, null, ORDERS_PAGE_SIZE),
        initialPageParam: null,
      }),
    ),
    // Status counts
    queryClient.prefetchQuery({
      queryKey: ORDERS_STATUS_COUNTS_QUERY_KEY,
      queryFn: async () => {
        if (isGuest) {
          const n = await countDraftsByCreator(profileId)
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
      <StatusOrdersView
        statuses={statuses}
        canCreate={!isGuest || statuses.includes('drafted')}
      />
    </HydrationBoundary>
  )
}
