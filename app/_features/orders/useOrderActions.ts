'use client'

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  deleteDraftOrderAction,
  duplicateOrderAction,
  transitionOrderAction,
} from './actions'
import {
  ORDERS_COUNT_QUERY_KEY,
  ORDERS_QUERY_KEY,
} from './queryKeys'
import type { Order, OrderStatus } from '@/lib/domain/order'
import type { OrdersCursor } from '@/lib/db/orderRepository'

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

export interface UseOrderActionsResult {
  transition: (args: {
    orderId: string
    toStatus: OrderStatus
    reason?: string
  }) => Promise<Order>
  deleteDraft: (args: { orderId: string; reason?: string }) => Promise<Order>
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
      queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
        patchOrder(old, args.orderId, {
          status: args.toStatus,
          statusUpdatedAt: new Date(),
        }),
      )
      return { previous }
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(ORDERS_QUERY_KEY, ctx.previous)
      }
    },
  })

  const deleteDraft = useMutation({
    mutationFn: deleteDraftOrderAction,
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: ORDERS_QUERY_KEY })
      const previous = queryClient.getQueryData<OrdersCache>(ORDERS_QUERY_KEY)
      queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
        patchOrder(old, args.orderId, {
          status: 'deleted',
          statusUpdatedAt: new Date(),
        }),
      )
      return { previous }
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(ORDERS_QUERY_KEY, ctx.previous)
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
    },
  })

  const isPending =
    transition.isPending || deleteDraft.isPending || duplicate.isPending
  const error =
    transition.error ?? deleteDraft.error ?? duplicate.error ?? null

  return {
    transition: (args) => transition.mutateAsync(args),
    deleteDraft: (args) => deleteDraft.mutateAsync(args),
    duplicate: (args) => duplicate.mutateAsync(args),
    isPending,
    error,
  }
}
