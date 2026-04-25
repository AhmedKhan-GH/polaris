// Shared between server (prefetch in app/page.tsx) and client (useOrders).
// Plain module --- no 'use client' directive --- so server components see
// the actual values instead of client-only references.

export const ORDERS_PAGE_SIZE = 50
export const ORDERS_QUERY_KEY = ['orders'] as const
export const ORDERS_COUNT_QUERY_KEY = ['orders', 'count'] as const
