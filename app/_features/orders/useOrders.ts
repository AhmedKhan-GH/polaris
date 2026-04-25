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
  createOrderAction,
  findOrdersPageAction,
} from './actions'
import {
  ORDERS_COUNT_QUERY_KEY,
  ORDERS_PAGE_SIZE,
  ORDERS_QUERY_KEY,
} from './ordersQuery'
import { getSupabaseClient } from '@/lib/supabase'
import { safeParseOrder, type Order } from '@/lib/domain/order'
import type { OrdersCursor } from '@/lib/db/orderRepository'

type OrdersCache = InfiniteData<Order[], OrdersCursor | null>

export interface UseOrdersResult {
  orders: Order[]
  totalCount: number
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

  // Total row count drives the virtualizer's spacer height. Without it the
  // scroll bar would shrink as each page loads, which feels lurchy. We
  // increment/decrement on realtime INSERT/DELETE so the spacer stays
  // accurate without refetching.
  const total = useQuery({
    queryKey: ORDERS_COUNT_QUERY_KEY,
    queryFn: () => countOrdersAction(),
  })

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
            queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) => {
              if (!old) return old
              if (old.pages[0]?.some((o) => o.id === row.id)) return old
              const [first, ...rest] = old.pages
              return { ...old, pages: [[row, ...(first ?? [])], ...rest] }
            })
            queryClient.setQueryData<number>(ORDERS_COUNT_QUERY_KEY, (n) =>
              (n ?? 0) + 1,
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

  // Defensive max(): if the count query is stale/late, the loaded set
  // can briefly exceed the cached total. The virtualizer should never
  // think there are fewer items than we've actually loaded.
  const totalCount = Math.max(orders.length, total.data ?? 0)

  return {
    orders,
    totalCount,
    isCreating: create.isPending,
    createOrder: () => create.mutate(),
    fetchNextPage: () => {
      void pages.fetchNextPage()
    },
    hasNextPage: pages.hasNextPage,
    isFetchingNextPage: pages.isFetchingNextPage,
  }
}
