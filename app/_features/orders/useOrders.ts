'use client'

import { useEffect, useMemo } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
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
  ordersByStatusQueryKey,
} from './queryKeys'
import {
  findStatusInPerStatusCaches,
  insertSortedIfInWindow,
  prependToCache,
  removeFromCache,
  updateInCache,
  type OrdersCache,
} from './cacheHelpers'
import { getSupabaseClient } from '@/lib/supabase/browser'
import { safeParseOrder, type Order } from '@/lib/domain/order'
import type {
  OrderStatusCounts,
  OrdersCursor,
} from '@/lib/db/orderRepository'

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

  // Single channel, single writer. The handler fans each event out to
  // the global cache (spreadsheet view) AND the per-status cache the
  // row belongs to (kanban columns), keeping all five in lockstep so
  // that any consumer reading from any cache sees the same row state.
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
            // New rows always start as 'draft' (DB default + insertOrder
            // / duplicateOrder both go through default values), so we
            // can hardcode the per-status target and skip the lookup.
            queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
              prependToCache(old, row),
            )
            queryClient.setQueryData<OrdersCache>(
              ordersByStatusQueryKey('draft'),
              (old) => prependToCache(old, row),
            )
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
            queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
              updateInCache(old, row),
            )
            // Default REPLICA IDENTITY only ships the PK in payload.old,
            // so we discover the row's previous status by scanning the
            // per-status caches for its id. O(loaded rows), only on
            // UPDATE.
            const prevStatus = findStatusInPerStatusCaches(queryClient, row.id)
            if (prevStatus === row.status) {
              queryClient.setQueryData<OrdersCache>(
                ordersByStatusQueryKey(row.status),
                (old) => updateInCache(old, row),
              )
            } else {
              if (prevStatus) {
                queryClient.setQueryData<OrdersCache>(
                  ordersByStatusQueryKey(prevStatus),
                  (old) => removeFromCache(old, row.id),
                )
              }
              queryClient.setQueryData<OrdersCache>(
                ordersByStatusQueryKey(row.status),
                (old) => insertSortedIfInWindow(old, row),
              )
            }
            void queryClient.invalidateQueries({
              queryKey: ORDERS_STATUS_COUNTS_QUERY_KEY,
            })
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id
            if (!oldId) return
            const prevStatus = findStatusInPerStatusCaches(queryClient, oldId)
            queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
              removeFromCache(old, oldId),
            )
            if (prevStatus) {
              queryClient.setQueryData<OrdersCache>(
                ordersByStatusQueryKey(prevStatus),
                (old) => removeFromCache(old, oldId),
              )
            }
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
