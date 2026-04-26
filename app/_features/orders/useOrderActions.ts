'use client'

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  discardDraftOrderAction,
  duplicateOrderAction,
  transitionOrderAction,
} from './actions'
import {
  ORDERS_COUNT_QUERY_KEY,
  ORDERS_QUERY_KEY,
  ORDERS_STATUS_COUNTS_QUERY_KEY,
} from './queryKeys'
import type { Order, OrderStatus } from '@/lib/domain/order'
import type {
  OrderStatusCounts,
  OrdersCursor,
} from '@/lib/db/orderRepository'

type OrdersCache = InfiniteData<Order[], OrdersCursor | null>

function patchOrder(
  cache: OrdersCache | undefined,
  orderId: string,
  patch: Partial<Order>,
): OrdersCache | undefined {
  if (!cache) return cache
  return {
    ...cache,
    pages: cache.pages.map((page) =>
      page.map((order) =>
        order.id === orderId ? { ...order, ...patch } : order,
      ),
    ),
  }
}

function findOrderStatus(
  cache: OrdersCache | undefined,
  orderId: string,
): OrderStatus | null {
  if (!cache) return null
  for (const page of cache.pages) {
    const found = page.find((o) => o.id === orderId)
    if (found) return found.status
  }
  return null
}

function shiftStatusCount(
  counts: OrderStatusCounts | undefined,
  from: OrderStatus | null,
  to: OrderStatus | null,
): OrderStatusCounts | undefined {
  if (!counts) return counts
  const next = { ...counts }
  if (from) next[from] = Math.max(0, (next[from] ?? 0) - 1)
  if (to) next[to] = (next[to] ?? 0) + 1
  return next
}

export interface UseOrderActionsResult {
  transition: (args: {
    orderId: string
    toStatus: OrderStatus
    reason?: string
  }) => Promise<Order>
  discardDraft: (args: { orderId: string; reason?: string }) => Promise<Order>
  duplicate: (args: { sourceOrderId: string }) => Promise<Order>
  isPending: boolean
  error: Error | null
}

// Wraps the order lifecycle server actions with optimistic cache writes.
// The realtime channel in useOrders eventually delivers the canonical
// row; the optimistic patch just keeps the UI from feeling laggy in the
// gap between click and Postgres LISTEN/NOTIFY.
export function useOrderActions(): UseOrderActionsResult {
  const queryClient = useQueryClient()

  const transition = useMutation({
    mutationFn: transitionOrderAction,
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: ORDERS_QUERY_KEY })
      const previous = queryClient.getQueryData<OrdersCache>(ORDERS_QUERY_KEY)
      const previousStatus = findOrderStatus(previous, args.orderId)
      const previousCounts = queryClient.getQueryData<OrderStatusCounts>(
        ORDERS_STATUS_COUNTS_QUERY_KEY,
      )
      queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
        patchOrder(old, args.orderId, {
          status: args.toStatus,
          statusUpdatedAt: new Date(),
        }),
      )
      queryClient.setQueryData<OrderStatusCounts>(
        ORDERS_STATUS_COUNTS_QUERY_KEY,
        (counts) => shiftStatusCount(counts, previousStatus, args.toStatus),
      )
      return { previous, previousCounts }
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(ORDERS_QUERY_KEY, ctx.previous)
      }
      if (ctx?.previousCounts) {
        queryClient.setQueryData(
          ORDERS_STATUS_COUNTS_QUERY_KEY,
          ctx.previousCounts,
        )
      }
    },
  })

  const discardDraft = useMutation({
    mutationFn: discardDraftOrderAction,
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: ORDERS_QUERY_KEY })
      const previous = queryClient.getQueryData<OrdersCache>(ORDERS_QUERY_KEY)
      const previousStatus = findOrderStatus(previous, args.orderId)
      const previousCounts = queryClient.getQueryData<OrderStatusCounts>(
        ORDERS_STATUS_COUNTS_QUERY_KEY,
      )
      queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
        patchOrder(old, args.orderId, {
          status: 'discarded',
          statusUpdatedAt: new Date(),
        }),
      )
      queryClient.setQueryData<OrderStatusCounts>(
        ORDERS_STATUS_COUNTS_QUERY_KEY,
        (counts) => shiftStatusCount(counts, previousStatus, 'discarded'),
      )
      return { previous, previousCounts }
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(ORDERS_QUERY_KEY, ctx.previous)
      }
      if (ctx?.previousCounts) {
        queryClient.setQueryData(
          ORDERS_STATUS_COUNTS_QUERY_KEY,
          ctx.previousCounts,
        )
      }
    },
  })

  const duplicate = useMutation({
    mutationFn: duplicateOrderAction,
    onSuccess: (created) => {
      queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) => {
        if (!old) return old
        const [first, ...rest] = old.pages
        if (first?.some((o) => o.id === created.id)) return old
        return { ...old, pages: [[created, ...(first ?? [])], ...rest] }
      })
      queryClient.setQueryData<number>(ORDERS_COUNT_QUERY_KEY, (n) =>
        (n ?? 0) + 1,
      )
      queryClient.setQueryData<OrderStatusCounts>(
        ORDERS_STATUS_COUNTS_QUERY_KEY,
        (counts) => shiftStatusCount(counts, null, created.status),
      )
    },
  })

  const isPending =
    transition.isPending || discardDraft.isPending || duplicate.isPending
  const error =
    transition.error ?? discardDraft.error ?? duplicate.error ?? null

  return {
    transition: (args) => transition.mutateAsync(args),
    discardDraft: (args) => discardDraft.mutateAsync(args),
    duplicate: (args) => duplicate.mutateAsync(args),
    isPending,
    error,
  }
}
