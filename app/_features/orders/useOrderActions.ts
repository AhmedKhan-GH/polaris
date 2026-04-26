'use client'

import {
  useMutation,
  useQueryClient,
  type QueryClient,
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
  ordersByStatusQueryKey,
} from './queryKeys'
import {
  findInCaches,
  insertSortedIfInWindow,
  prependToCache,
  removeFromCache,
  updateInCache,
  type OrdersCache,
} from './cacheHelpers'
import type { Order, OrderStatus } from '@/lib/domain/order'
import type { OrderStatusCounts } from '@/lib/db/orderRepository'

function patchOrderInGlobal(
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

// Optimistically move a row between per-status caches. The caller has
// already produced the patched row (with the new status); we use the
// FROM cache to remove and the TO cache to insert at the right sort
// position. When fromStatus === toStatus we degrade to an in-place
// update so a non-status-changing patch (e.g. a status-noop) doesn't
// drop the row.
function moveBetweenStatusCaches(
  queryClient: QueryClient,
  patchedRow: Order,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
) {
  if (fromStatus === toStatus) {
    queryClient.setQueryData<OrdersCache>(
      ordersByStatusQueryKey(toStatus),
      (old) => updateInCache(old, patchedRow),
    )
    return
  }
  queryClient.setQueryData<OrdersCache>(
    ordersByStatusQueryKey(fromStatus),
    (old) => removeFromCache(old, patchedRow.id),
  )
  queryClient.setQueryData<OrdersCache>(
    ordersByStatusQueryKey(toStatus),
    (old) => insertSortedIfInWindow(old, patchedRow),
  )
}

interface TransitionContext {
  previousGlobal: OrdersCache | undefined
  previousCounts: OrderStatusCounts | undefined
  previousFromCache: OrdersCache | undefined
  previousToCache: OrdersCache | undefined
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
}

function rollbackTransition(
  queryClient: QueryClient,
  ctx: TransitionContext,
) {
  if (ctx.previousGlobal) {
    queryClient.setQueryData(ORDERS_QUERY_KEY, ctx.previousGlobal)
  }
  if (ctx.previousCounts) {
    queryClient.setQueryData(
      ORDERS_STATUS_COUNTS_QUERY_KEY,
      ctx.previousCounts,
    )
  }
  if (ctx.fromStatus) {
    queryClient.setQueryData(
      ordersByStatusQueryKey(ctx.fromStatus),
      ctx.previousFromCache,
    )
  }
  queryClient.setQueryData(
    ordersByStatusQueryKey(ctx.toStatus),
    ctx.previousToCache,
  )
}

async function applyOptimisticTransition(
  queryClient: QueryClient,
  orderId: string,
  toStatus: OrderStatus,
): Promise<TransitionContext> {
  await queryClient.cancelQueries({ queryKey: ORDERS_QUERY_KEY })
  // Capture pre-mutation cache state for rollback.
  const previousGlobal = queryClient.getQueryData<OrdersCache>(ORDERS_QUERY_KEY)
  const previousCounts = queryClient.getQueryData<OrderStatusCounts>(
    ORDERS_STATUS_COUNTS_QUERY_KEY,
  )
  const current = findInCaches(queryClient, orderId)
  const fromStatus = current?.status ?? null
  const previousFromCache = fromStatus
    ? queryClient.getQueryData<OrdersCache>(ordersByStatusQueryKey(fromStatus))
    : undefined
  const previousToCache = queryClient.getQueryData<OrdersCache>(
    ordersByStatusQueryKey(toStatus),
  )

  const patch: Partial<Order> = {
    status: toStatus,
    statusUpdatedAt: new Date(),
  }

  queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
    patchOrderInGlobal(old, orderId, patch),
  )
  queryClient.setQueryData<OrderStatusCounts>(
    ORDERS_STATUS_COUNTS_QUERY_KEY,
    (counts) => shiftStatusCount(counts, fromStatus, toStatus),
  )

  if (current && fromStatus) {
    moveBetweenStatusCaches(
      queryClient,
      { ...current, ...patch },
      fromStatus,
      toStatus,
    )
  }

  return {
    previousGlobal,
    previousCounts,
    previousFromCache,
    previousToCache,
    fromStatus,
    toStatus,
  }
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
// gap between click and Postgres LISTEN/NOTIFY. Each mutation must keep
// the global cache, the per-status caches, and the status-counts
// aggregate consistent --- otherwise the kanban will briefly disagree
// with itself.
export function useOrderActions(): UseOrderActionsResult {
  const queryClient = useQueryClient()

  const transition = useMutation({
    mutationFn: transitionOrderAction,
    onMutate: (args) =>
      applyOptimisticTransition(queryClient, args.orderId, args.toStatus),
    onError: (_err, _args, ctx) => {
      if (ctx) rollbackTransition(queryClient, ctx)
    },
  })

  const discardDraft = useMutation({
    mutationFn: discardDraftOrderAction,
    onMutate: (args) =>
      applyOptimisticTransition(queryClient, args.orderId, 'discarded'),
    onError: (_err, _args, ctx) => {
      if (ctx) rollbackTransition(queryClient, ctx)
    },
  })

  const duplicate = useMutation({
    mutationFn: duplicateOrderAction,
    onSuccess: (created) => {
      queryClient.setQueryData<OrdersCache>(ORDERS_QUERY_KEY, (old) =>
        prependToCache(old, created),
      )
      queryClient.setQueryData<OrdersCache>(
        ordersByStatusQueryKey(created.status),
        (old) => prependToCache(old, created),
      )
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
