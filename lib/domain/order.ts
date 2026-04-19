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
