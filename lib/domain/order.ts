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
