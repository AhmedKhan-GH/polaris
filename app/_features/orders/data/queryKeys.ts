// Shared between server (prefetch in app/page.tsx) and client (useOrders).
// Plain module --- no 'use client' directive --- so server components see
// the actual values instead of client-only references.

import type { OrderStatus } from '@/lib/domain/order'
import type { OrderFilters } from '@/lib/db/orderRepository'

export const ORDERS_PAGE_SIZE = 50
export const ORDERS_QUERY_KEY = ['orders'] as const
export const ORDERS_COUNT_QUERY_KEY = ['orders', 'count'] as const
export const SPREADSHEET_ORDERS_QUERY_KEY = [
  'orders',
  'spreadsheet',
] as const
export const ORDERS_STATUS_COUNTS_QUERY_KEY = [
  'orders',
  'status-counts',
] as const

// Per-status pagination key. Each kanban column owns its own infinite
// query keyed by status so a sparse column doesn't depend on the global
// newest-first stream walking past every fresher draft.
export function ordersByStatusQueryKey(status: OrderStatus) {
  return ['orders', 'by-status', status] as const
}

export function spreadsheetOrdersQueryKey(filters: OrderFilters) {
  return [...SPREADSHEET_ORDERS_QUERY_KEY, 'page', filters] as const
}

export function spreadsheetOrdersCountQueryKey(filters: OrderFilters) {
  return [...SPREADSHEET_ORDERS_QUERY_KEY, 'count', filters] as const
}

export function spreadsheetOrderStatusCountsQueryKey(filters: OrderFilters) {
  return [...SPREADSHEET_ORDERS_QUERY_KEY, 'status-counts', filters] as const
}
