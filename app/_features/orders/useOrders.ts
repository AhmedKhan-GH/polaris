'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createOrderAction, findOrdersPageAction } from './actions'
import { ORDERS_PAGE_SIZE, ORDERS_QUERY_KEY } from './ordersQuery'
import { getSupabaseClient } from '@/lib/supabase'
import { safeParseOrder, type Order } from '@/lib/domain/order'
import type { OrdersCursor } from '@/lib/db/orderRepository'

type OrdersPage = Order[]
type OrdersCache = InfiniteData<OrdersPage, OrdersCursor | null>

export interface UseOrdersResult {
  orders: Order[]
  isCreating: boolean
  createOrder: () => void
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  pendingCount: number
  revealPending: () => void
}

function isInCache(cache: OrdersCache | undefined, id: string): boolean {
  if (!cache) return false
  return cache.pages.some((page) => page.some((o) => o.id === id))
}

function prependToFirstPage(
  cache: OrdersCache | undefined,
  rows: Order[],
): OrdersCache | undefined {
  if (!cache) return cache
  const [first, ...rest] = cache.pages
  const existingIds = new Set((first ?? []).map((o) => o.id))
  const fresh = rows.filter((r) => !existingIds.has(r.id))
  if (fresh.length === 0) return cache
  return { ...cache, pages: [[...fresh, ...(first ?? [])], ...rest] }
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

  // Foreign INSERTs (other users' creates) are buffered here instead of
  // being injected into the cache directly --- the user opts in to seeing
  // them by clicking the pill. Own creates skip the buffer and apply
  // immediately because we want the click → see-your-card feedback loop.
  const [pendingInserts, setPendingInserts] = useState<Order[]>([])

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
            // Skip if our own createOrder() already wrote this row to the
            // cache via the action's response. That covers two cases:
            // (1) action resolved before realtime arrived, the cache
            //     already has the row → ignore
            // (2) realtime arrived first, this handler runs before the
            //     action resolves → buffer; createOrder() will move it
            //     out of pending after it gets the action's response.
            const cache = queryClient.getQueryData<OrdersCache>(ORDERS_QUERY_KEY)
            if (isInCache(cache, incoming.id)) return
            setPendingInserts((prev) =>
              prev.some((p) => p.id === incoming.id) ? prev : [incoming, ...prev],
            )
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
            // Also drop from the pending buffer in case it was buffered
            // and never revealed before being deleted.
            setPendingInserts((prev) => prev.filter((p) => p.id !== oldId))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const [isCreating, setIsCreating] = useState(false)
  const actionInFlight = useRef(false)

  async function createOrder() {
    if (actionInFlight.current) return
    actionInFlight.current = true
    setIsCreating(true)
    try {
      const created = await createOrderAction()
      // Apply to the cache directly so the user sees their own card
      // immediately. If realtime delivered first and buffered it, also
      // remove from pending so the count doesn't tick up for our row.
      queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
        prependToFirstPage(old, [created]),
      )
      setPendingInserts((prev) => prev.filter((p) => p.id !== created.id))
    } finally {
      actionInFlight.current = false
      setIsCreating(false)
    }
  }

  function revealPending() {
    if (pendingInserts.length === 0) return
    const toReveal = pendingInserts
    queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
      prependToFirstPage(old, toReveal),
    )
    setPendingInserts([])
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
    pendingCount: pendingInserts.length,
    revealPending,
  }
}
