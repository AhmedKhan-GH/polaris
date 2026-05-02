'use client'

import { useMemo } from 'react'
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { findOrdersPageByStatusAction } from './actions'
import { ORDERS_PAGE_SIZE, ordersByStatusQueryKey } from './queryKeys'
import { dedupeById, type Order, type OrderStatus } from '@/lib/domain/order'
import type { OrdersCursor } from '@/lib/db/orderRepository'

type Cache = InfiniteData<Order[], OrdersCursor | null>

export interface UseOrdersByStatusResult {
  cards: Order[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

// Each kanban column subscribes to one of these. The realtime channel
// in useOrders is the single writer that syncs INSERT/UPDATE/DELETE
// across these per-status caches; this hook itself only handles
// fetching and pagination.
export function useOrdersByStatus(
  status: OrderStatus,
): UseOrdersByStatusResult {
  const query = useInfiniteQuery<
    Order[],
    Error,
    Cache,
    ReturnType<typeof ordersByStatusQueryKey>,
    OrdersCursor | null
  >({
    queryKey: ordersByStatusQueryKey(status),
    queryFn: ({ pageParam }) =>
      findOrdersPageByStatusAction(status, pageParam, ORDERS_PAGE_SIZE),
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < ORDERS_PAGE_SIZE) return undefined
      const last = lastPage[lastPage.length - 1]
      return { createdAt: last.createdAt, id: last.id }
    },
  })

  const cards = useMemo(
    () => dedupeById(query.data?.pages.flat() ?? []),
    [query.data],
  )

  return {
    cards,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage()
    },
  }
}
