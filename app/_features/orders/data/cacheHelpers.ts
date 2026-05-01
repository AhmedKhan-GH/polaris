import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { Order, OrderStatus } from '@/lib/domain/order'
import { ORDER_STATUSES } from '@/lib/domain/order'
import type { OrdersCursor } from '@/lib/db/orderRepository'
import {
  ORDERS_PAGE_SIZE,
  ORDERS_QUERY_KEY,
  LIST_ORDERS_QUERY_KEY,
  ordersByStatusQueryKey,
} from './queryKeys'

export type OrdersCache = InfiniteData<Order[], OrdersCursor | null>

function findInOrdersCache(
  cache: OrdersCache | undefined,
  orderId: string,
): Order | null {
  if (!cache) return null
  for (const page of cache.pages) {
    const found = page.find((o) => o.id === orderId)
    if (found) return found
  }
  return null
}

function findInUnknownOrdersCache(data: unknown, orderId: string): Order | null {
  if (!data || typeof data !== 'object' || !('pages' in data)) return null
  const pages = (data as { pages?: unknown }).pages
  if (!Array.isArray(pages)) return null
  for (const page of pages) {
    if (!Array.isArray(page)) continue
    const found = page.find(
      (o): o is Order =>
        !!o && typeof o === 'object' && 'id' in o && o.id === orderId,
    )
    if (found) return found
  }
  return null
}

// Sort order matches findOrdersPage: createdAt DESC, id DESC. Returns
// negative when `a` comes BEFORE `b` in the displayed list (newer first
// or, on ties, higher id first).
function compareDesc(
  a: { createdAt: Date; id: string },
  b: { createdAt: Date; id: string },
): number {
  const at = a.createdAt.getTime()
  const bt = b.createdAt.getTime()
  if (at !== bt) return bt - at
  if (a.id > b.id) return -1
  if (a.id < b.id) return 1
  return 0
}

export function prependToCache(
  cache: OrdersCache | undefined,
  row: Order,
): OrdersCache | undefined {
  if (!cache) return cache
  if (cache.pages.some((page) => page.some((o) => o.id === row.id))) {
    return cache
  }
  const [first, ...rest] = cache.pages
  return { ...cache, pages: [[row, ...(first ?? [])], ...rest] }
}

export function removeFromCache(
  cache: OrdersCache | undefined,
  orderId: string,
): OrdersCache | undefined {
  if (!cache) return cache
  let removed = false
  const pages = cache.pages.map((page) => {
    const next = page.filter((o) => {
      if (o.id === orderId) {
        removed = true
        return false
      }
      return true
    })
    return removed && next.length === page.length ? page : next
  })
  if (!removed) return cache
  return { ...cache, pages }
}

// In-place patch of a row that's known to be in this cache and whose
// sort key (createdAt, id) hasn't changed. Use insertSortedIfInWindow
// instead when status changes — that one handles repositioning.
export function updateInCache(
  cache: OrdersCache | undefined,
  row: Order,
): OrdersCache | undefined {
  if (!cache) return cache
  let touched = false
  const pages = cache.pages.map((page) =>
    page.map((o) => {
      if (o.id !== row.id) return o
      touched = true
      return row
    }),
  )
  if (!touched) return cache
  return { ...cache, pages }
}

// Inserts `row` at its sorted position iff (a) the cache is fully
// loaded (last page is short, no next page) OR (b) `row` sorts at-or-
// newer than the cache's last loaded element. When the row is older
// than everything loaded AND more pages remain, drop it on the floor —
// scrolling will pull it in from the server in its natural place.
//
// Idempotent: if `row.id` is already in the cache, returns the cache
// unchanged.
export function insertSortedIfInWindow(
  cache: OrdersCache | undefined,
  row: Order,
): OrdersCache | undefined {
  if (!cache) return cache
  if (cache.pages.some((page) => page.some((o) => o.id === row.id))) {
    return cache
  }

  const lastPage = cache.pages[cache.pages.length - 1] ?? []
  const hasNext = lastPage.length === ORDERS_PAGE_SIZE

  if (lastPage.length === 0) {
    return { ...cache, pages: cache.pages.length === 0 ? [[row]] : [...cache.pages.slice(0, -1), [row]] }
  }

  const lastLoaded = lastPage[lastPage.length - 1]
  if (hasNext && compareDesc(row, lastLoaded) > 0) {
    return cache
  }

  // Find the page + intra-page index for the sorted insertion point.
  for (let p = 0; p < cache.pages.length; p++) {
    const page = cache.pages[p]
    for (let i = 0; i < page.length; i++) {
      if (compareDesc(row, page[i]) <= 0) {
        const newPage = [...page.slice(0, i), row, ...page.slice(i)]
        const pages = cache.pages.map((pg, idx) => (idx === p ? newPage : pg))
        return { ...cache, pages }
      }
    }
  }

  // Sorts after every loaded row. Reachable only when !hasNext (window
  // check above lets it through). Append to the last page.
  const lastIdx = cache.pages.length - 1
  const pages = cache.pages.map((pg, idx) =>
    idx === lastIdx ? [...pg, row] : pg,
  )
  return { ...cache, pages }
}

// Walks the global cache and every per-status cache for an order with
// matching id. Used for the right-sidebar lookup, since a row might be
// loaded in a kanban column but not yet reached by the global query's
// pagination (or vice versa).
export function findInCaches(
  queryClient: QueryClient,
  orderId: string,
): Order | null {
  const global = queryClient.getQueryData<OrdersCache>(ORDERS_QUERY_KEY)
  const globalMatch = findInOrdersCache(global, orderId)
  if (globalMatch) return globalMatch
  for (const status of ORDER_STATUSES) {
    const data = queryClient.getQueryData<OrdersCache>(
      ordersByStatusQueryKey(status),
    )
    const statusMatch = findInOrdersCache(data, orderId)
    if (statusMatch) return statusMatch
  }
  for (const query of queryClient.getQueryCache().findAll({
    queryKey: LIST_ORDERS_QUERY_KEY,
  })) {
    const listMatch = findInUnknownOrdersCache(query.state.data, orderId)
    if (listMatch) return listMatch
  }
  return null
}

// Status of `orderId` as currently held in the per-status caches, or
// null if no per-status cache has it. The realtime UPDATE handler uses
// this to discover the previous status (Supabase's payload.old only
// carries the PK by default).
export function findStatusInPerStatusCaches(
  queryClient: QueryClient,
  orderId: string,
): OrderStatus | null {
  for (const status of ORDER_STATUSES) {
    const data = queryClient.getQueryData<OrdersCache>(
      ordersByStatusQueryKey(status),
    )
    if (!data) continue
    if (data.pages.some((page) => page.some((o) => o.id === orderId))) {
      return status
    }
  }
  return null
}
