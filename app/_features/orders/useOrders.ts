'use client'

import { useEffect, useMemo } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import {
  countOrdersAction,
  countOrdersByStatusAction,
  createOrderAction,
  findOrdersPageAction,
} from './actions'
import {
  ORDERS_COUNT_QUERY_KEY,
  ORDERS_PAGE_SIZE,
  ORDERS_QUERY_KEY,
  ORDERS_STATUS_COUNTS_QUERY_KEY,
} from './queryKeys'
import { getSupabaseClient } from '@/lib/supabase/browser'
import { safeParseOrder, type Order } from '@/lib/domain/order'
import type {
  OrderStatusCounts,
  OrdersCursor,
} from '@/lib/db/orderRepository'

type OrdersCache = InfiniteData<Order[], OrdersCursor | null>

export interface UseOrdersResult {
  orders: Order[]
  totalCount: number
  statusCounts: OrderStatusCounts | undefined
  isCreating: boolean
  createOrder: () => void
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
}

export function useOrders(): UseOrdersResult {
  const queryClient = useQueryClient()

  const pages = useInfiniteQuery<
    Order[],
    Error,
    OrdersCache,
    typeof ORDERS_QUERY_KEY,
    OrdersCursor | null
  >({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: ({ pageParam }) => findOrdersPageAction(pageParam, ORDERS_PAGE_SIZE),
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < ORDERS_PAGE_SIZE) return undefined
      const last = lastPage[lastPage.length - 1]
      return { createdAt: last.createdAt.toISOString(), id: last.id }
    },
  })

  const total = useQuery({
    queryKey: ORDERS_COUNT_QUERY_KEY,
    queryFn: () => countOrdersAction(),
  })

  const statusCounts = useQuery({
    queryKey: ORDERS_STATUS_COUNTS_QUERY_KEY,
    queryFn: () => countOrdersByStatusAction(),
  })

  // Realtime mutates the cache directly. No eviction means cards[i]
  // always equals global row i, so the cache-based idempotency check
  // is enough --- a redelivered INSERT for any loaded row is caught
  // by `cache.pages.some(...)`.
  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('orders-board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === 'INSERT') {
            const row = safeParseOrder(payload.new, 'insert')
            if (!row) return
            const cache = queryClient.getQueryData<OrdersCache>(ORDERS_QUERY_KEY)
            if (cache?.pages.some((page) => page.some((o) => o.id === row.id))) {
              return
            }
            queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) => {
              if (!old) return old
              const [first, ...rest] = old.pages
              return { ...old, pages: [[row, ...(first ?? [])], ...rest] }
            })
            queryClient.setQueryData<number>(ORDERS_COUNT_QUERY_KEY, (n) =>
              (n ?? 0) + 1,
            )
            queryClient.setQueryData<OrderStatusCounts>(
              ORDERS_STATUS_COUNTS_QUERY_KEY,
              (counts) =>
                counts
                  ? { ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }
                  : counts,
            )
          } else if (payload.eventType === 'UPDATE') {
            const row = safeParseOrder(payload.new, 'update')
            if (!row) return
            queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) => {
              if (!old) return old
              return {
                ...old,
                pages: old.pages.map((page) =>
                  page.map((o) => (o.id === row.id ? row : o)),
                ),
              }
            })
            // Status may have changed; payload.old only carries the PK
            // by default, so we can't compute the diff locally. Refetch
            // is the simplest path that keeps counts honest.
            void queryClient.invalidateQueries({
              queryKey: ORDERS_STATUS_COUNTS_QUERY_KEY,
            })
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id
            if (!oldId) return
            queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) => {
              if (!old) return old
              return {
                ...old,
                pages: old.pages.map((page) => page.filter((o) => o.id !== oldId)),
              }
            })
            queryClient.setQueryData<number>(ORDERS_COUNT_QUERY_KEY, (n) =>
              Math.max(0, (n ?? 0) - 1),
            )
            void queryClient.invalidateQueries({
              queryKey: ORDERS_STATUS_COUNTS_QUERY_KEY,
            })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const create = useMutation({
    mutationFn: () => createOrderAction(),
  })

  const orders = useMemo(
    () => pages.data?.pages.flat() ?? [],
    [pages.data],
  )

  // Once we know we've fetched everything (last page < PAGE_SIZE,
  // hasNextPage=false), trust orders.length as the exact total --- the
  // server count might be slightly stale, and once we have it all
  // there's no reason to extend the scroll bar past actual data.
  const totalCount = pages.hasNextPage
    ? Math.max(orders.length, total.data ?? 0)
    : orders.length

  return {
    orders,
    totalCount,
    statusCounts: statusCounts.data,
    isCreating: create.isPending,
    createOrder: () => create.mutate(),
    fetchNextPage: () => {
      void pages.fetchNextPage()
    },
    hasNextPage: pages.hasNextPage,
    isFetchingNextPage: pages.isFetchingNextPage,
  }
}
