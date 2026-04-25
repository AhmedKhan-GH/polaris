'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createOrderAction, findOrdersPageAction } from './actions'
import { getSupabaseClient } from '@/lib/supabase'
import { safeParseOrder, type Order } from '@/lib/domain/order'
import type { OrdersCursor } from '@/lib/db/orderRepository'

export const ORDERS_PAGE_SIZE = 50
export const ORDERS_QUERY_KEY = ['orders'] as const

type OrdersPage = Order[]
type OrdersCache = InfiniteData<OrdersPage, OrdersCursor | null>

export interface UseOrdersResult {
  orders: Order[]
  isCreating: boolean
  createOrder: () => void
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
}

export function useOrders(): UseOrdersResult {
  const queryClient = useQueryClient()

  const query = useInfiniteQuery<
    OrdersPage,
    Error,
    InfiniteData<OrdersPage, OrdersCursor | null>,
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

  // Realtime mutates the query cache directly so paginated state and live
  // events share one source of truth. INSERT prepends to page 0, UPDATE
  // replaces in place across all loaded pages, DELETE filters by id.
  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('orders-board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === 'INSERT') {
            const incoming = safeParseOrder(payload.new, 'insert')
            if (!incoming) return
            queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) => {
              if (!old) return old
              if (old.pages[0]?.some((o) => o.id === incoming.id)) return old
              const [first, ...rest] = old.pages
              return { ...old, pages: [[incoming, ...(first ?? [])], ...rest] }
            })
          } else if (payload.eventType === 'UPDATE') {
            const incoming = safeParseOrder(payload.new, 'update')
            if (!incoming) return
            queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) => {
              if (!old) return old
              return {
                ...old,
                pages: old.pages.map((page) =>
                  page.map((o) => (o.id === incoming.id ? incoming : o)),
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
                pages: old.pages.map((page) =>
                  page.filter((o) => o.id !== oldId),
                ),
              }
            })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const [isCreating, setIsCreating] = useState(false)
  // Synchronous guard for back-to-back programmatic calls in the same
  // microtask --- the disabled button covers user clicks, but two
  // closures over pre-update state would both pass the `isCreating`
  // check. Not DOS protection; real throttling lives server-side.
  const actionInFlight = useRef(false)

  async function createOrder() {
    if (actionInFlight.current) return
    actionInFlight.current = true
    setIsCreating(true)
    try {
      await createOrderAction()
      // Realtime delivers the new tile via the INSERT handler above;
      // we discard the action's return value on purpose so there's
      // exactly one path that adds rows to local state.
    } finally {
      actionInFlight.current = false
      setIsCreating(false)
    }
  }

  const orders = useMemo(
    () => query.data?.pages.flat() ?? [],
    [query.data],
  )

  return {
    orders,
    isCreating,
    createOrder,
    fetchNextPage: () => {
      void query.fetchNextPage()
    },
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  }
}
