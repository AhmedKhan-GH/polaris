import { z } from 'zod'

export const ORDER_STATUSES = [
  'drafted',
  'submitted',
  'invoiced',
  'completed',
  'archived',
  'discarded',
  'rejected',
  'voided',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'drafted',
  'submitted',
  'invoiced',
  'completed',
]

export type Order = {
  id: string
  orderNumber: number
  status: OrderStatus
  statusUpdatedAt: Date
  duplicatedFromOrderId: string | null
  createdAt: Date
}

export function toOrder(row: {
  id: string
  orderNumber: number
  status: OrderStatus
  statusUpdatedAt: Date
  duplicatedFromOrderId: string | null
  createdAt: Date
}): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    statusUpdatedAt: row.statusUpdatedAt,
    duplicatedFromOrderId: row.duplicatedFromOrderId,
    createdAt: row.createdAt,
  }
}

// Realtime / REST payloads use snake_case with string-or-number bigints and
// ISO timestamps. Validate + normalize at the boundary before the row is
// allowed to become an Order.
export const orderRowSchema = z
  .object({
    id: z.string().uuid(),
    order_number: z
      .union([z.number(), z.string()])
      .transform((v) => (typeof v === 'number' ? v : Number(v))),
    status: z.enum(ORDER_STATUSES),
    status_updated_at: z.string().transform((s) => new Date(s)),
    duplicated_from_order_id: z.string().uuid().nullable(),
    created_at: z.string().transform((s) => new Date(s)),
  })
  .transform((row): Order => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    duplicatedFromOrderId: row.duplicated_from_order_id,
    createdAt: row.created_at,
  }))

export function parseOrderRow(row: unknown): Order {
  return orderRowSchema.parse(row)
}

export function safeParseOrder(
  row: unknown,
  source: 'insert' | 'update',
): Order | null {
  try {
    return parseOrderRow(row)
  } catch (err) {
    console.warn(`[orders] ignored malformed ${source} payload`, { row, err })
    return null
  }
}

export function sortOrdersNewestFirst<T extends { createdAt: Date }>(
  orders: T[],
): T[] {
  return [...orders].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
}

export function mergeById<T extends { id: string }>(list: T[], next: T): T[] {
  const index = list.findIndex((item) => item.id === next.id)
  if (index === -1) return [next, ...list]
  const copy = list.slice()
  copy[index] = next
  return copy
}

export function dedupeById<T extends { id: string }>(list: readonly T[]): T[] {
  const seen = new Set<string>()
  return list.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

// Locale + options pinned so server-rendered output matches the client's
// first paint --- otherwise hydration mismatches on the comma/space and
// 12h vs 24h based on the user's system. Shared between the kanban
// card and the spreadsheet "Created" column.
export function formatCreatedAt(date: Date): string {
  const d = new Date(date)
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  return `${datePart} · ${timePart}`
}
