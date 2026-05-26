import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query'
import {
  countOrdersByStatus,
  countFilteredOrdersByStatus,
  findOrdersPageByStatus,
  findFilteredOrdersPage,
} from '@/lib/db/orderRepository'
import { ACTIVE_ORDER_STATUSES, type OrderStatus } from '@/lib/domain/order'
import type { UserRole } from '@/lib/profile'
import {
  ORDERS_PAGE_SIZE,
  ORDERS_STATUS_COUNTS_QUERY_KEY,
  ordersByStatusQueryKey,
} from '../../../_features/orders/data/queryKeys'
import { OrdersShell } from '../../../_features/orders/views/OrdersShell'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/permissions/abilities'

export default async function OrdersPage() {
  const profile = await getProfile()
  if (!profile) notFound()

  const ability = defineAbilityFor(profile.role)
  if (!ability.can('read', 'Order')) {
    notFound()
  }

  const isGuest = profile.role === 'guest'
  const statuses = ACTIVE_ORDER_STATUSES

  return (
    <Suspense fallback={<OrdersLoading />}>
      <OrdersData profileId={profile.id} role={profile.role} isGuest={isGuest} statuses={statuses} />
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
  role,
  isGuest,
  statuses,
}: {
  profileId: string
  role: UserRole
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
          isGuest
            ? findFilteredOrdersPage({ statuses: [status], createdBy: profileId }, null, ORDERS_PAGE_SIZE)
            : findOrdersPageByStatus(status, null, ORDERS_PAGE_SIZE),
        initialPageParam: null,
      }),
    ),
    // Status counts
    queryClient.prefetchQuery({
      queryKey: ORDERS_STATUS_COUNTS_QUERY_KEY,
      queryFn: () =>
        isGuest
          ? countFilteredOrdersByStatus({ createdBy: profileId })
          : countOrdersByStatus(),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersShell
        statuses={statuses}
        canCreate={true}
        role={role}
        isGuest={isGuest}
        profileId={profileId}
      />
    </HydrationBoundary>
  )
}
