import { z } from 'zod'

export type Order = {
  id: string
  orderNumber: number
  createdAt: Date
}

export function toOrder(row: {
  id: string
  orderNumber: number
  createdAt: Date
}): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
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
    created_at: z.string().transform((s) => new Date(s)),
  })
  .transform((row): Order => ({
    id: row.id,
    orderNumber: row.order_number,
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
