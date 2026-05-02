import { z } from 'zod'

export const ORDER_STATUSES = [
  'drafted',
  'submitted',
  'invoiced',
  'closed',
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
  'closed',
]

// Timestamps are unix epoch milliseconds (UTC). Display layer converts
// to the user's chosen timezone at render time.
export type Order = {
  id: string
  orderNumber: number
  status: OrderStatus
  statusUpdatedAt: number
  duplicatedFromOrderId: string | null
  createdAt: number
}

export function toOrder(row: {
  id: string
  orderNumber: number
  status: OrderStatus
  statusUpdatedAt: number
  duplicatedFromOrderId: string | null
  createdAt: number
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

// Postgres bigint can arrive as number (when small enough) or string
// (driver-dependent). Coerce both to a finite number; ms-since-epoch
// stays inside Number.MAX_SAFE_INTEGER until year 287396.
const epochMs = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : Number(v)))
  .refine((n) => Number.isFinite(n), { message: 'expected epoch ms' })

// Realtime / REST payloads use snake_case with string-or-number bigints.
// Validate + normalize at the boundary before the row is allowed to
// become an Order.
export const orderRowSchema = z
  .object({
    id: z.string().uuid(),
    order_number: z
      .union([z.number(), z.string()])
      .transform((v) => (typeof v === 'number' ? v : Number(v))),
    status: z.enum(ORDER_STATUSES),
    status_updated_at: epochMs,
    duplicated_from_order_id: z.string().uuid().nullable(),
    created_at: epochMs,
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

export function sortOrdersNewestFirst<T extends { createdAt: number }>(
  orders: T[],
): T[] {
  return [...orders].sort((a, b) => b.createdAt - a.createdAt)
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
// card and the list "Created" column. Date is composed manually
// in the local timezone as ISO 'yyyy-mm-dd' (military / sortable form),
// time uses hourCycle 'h23' so midnight reads as '00' rather than '24'
// on the few locales that confuse hour12:false with hourCycle h24.
export function formatCreatedAt(ms: number): string {
  const d = new Date(ms)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const datePart = `${yyyy}-${mm}-${dd}`
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  return `${datePart} · ${timePart}`
}
