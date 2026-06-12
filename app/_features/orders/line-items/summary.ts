import type { OrderLineItem } from '@/lib/domain/orderLineItem'

export const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export const QUANTITY_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 3,
})

export function getLineItemTotal(lineItem: OrderLineItem): number | null {
  if (lineItem.unitPrice === null) return null
  return lineItem.quantity * lineItem.unitPrice
}

export function getLineItemSummary(lineItems: readonly OrderLineItem[]) {
  return lineItems.reduce(
    (summary, lineItem) => {
      const lineTotal = getLineItemTotal(lineItem)
      return {
        count: summary.count + 1,
        totalCost: summary.totalCost + (lineTotal ?? 0),
        pricedCount: summary.pricedCount + (lineTotal === null ? 0 : 1),
      }
    },
    { count: 0, pricedCount: 0, totalCost: 0 },
  )
}

export function formatMoney(value: number | null) {
  return value === null ? '-' : MONEY_FORMATTER.format(value)
}

export function formatQuantity(value: number) {
  return QUANTITY_FORMATTER.format(value)
}

export function formatItemCount(count: number) {
  return `${count} ${count === 1 ? 'item' : 'items'}`
}
