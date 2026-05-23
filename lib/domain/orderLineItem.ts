export type SkuOption = {
  id: string
  skuNumber: string
  name: string
  defaultUnit: string | null
}

export type OrderLineItem = {
  id: string
  orderId: string
  skuId: string
  skuNumber: string
  skuName: string
  lineNumber: number
  quantity: number
  unit: string
  unitPrice: number | null
  notes: string | null
  createdAt: number
  updatedAt: number
}

function optionalNumber(value: number | string | null): number | null {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function toSkuOption(row: {
  id: string
  skuNumber: string
  name: string
  defaultUnit: string | null
}): SkuOption {
  return row
}

export function toOrderLineItem(row: {
  id: string
  orderId: string
  skuId: string
  skuNumber: string
  skuName: string
  lineNumber: number
  quantity: number | string
  unit: string
  unitPrice: number | string | null
  notes: string | null
  createdAt: number
  updatedAt: number
}): OrderLineItem {
  return {
    ...row,
    quantity: Number(row.quantity),
    unitPrice: optionalNumber(row.unitPrice),
  }
}
