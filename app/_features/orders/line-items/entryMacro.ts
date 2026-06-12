import type { SkuOption } from '@/lib/domain/orderLineItem'

export interface ParsedEntryMacro {
  sku: SkuOption
  quantity: string | null
  unit: string | null
  unitPrice: string | null
  hasMacro: boolean
}

export function findSkuFromInput(
  input: string,
  skuOptions: readonly SkuOption[],
) {
  const normalized = input.trim().toLowerCase()
  return skuOptions.find((sku) => {
    const label = `${sku.skuNumber} - ${sku.name}`.toLowerCase()
    return (
      label === normalized ||
      sku.skuNumber.toLowerCase() === normalized ||
      sku.name.toLowerCase() === normalized
    )
  })
}

export function parseEntryMacro(
  input: string,
  skuOptions: readonly SkuOption[],
): ParsedEntryMacro | null {
  const normalized = input.trim()
  if (!normalized) return null

  const sortedOptions = [...skuOptions].sort((a, b) => {
    const aLength = Math.max(a.skuNumber.length, a.name.length)
    const bLength = Math.max(b.skuNumber.length, b.name.length)
    return bLength - aLength
  })

  for (const sku of sortedOptions) {
    const candidates = [`${sku.skuNumber} - ${sku.name}`, sku.skuNumber, sku.name]
    for (const candidate of candidates) {
      if (!normalized.toLowerCase().startsWith(candidate.toLowerCase())) {
        continue
      }

      const rest = normalized.slice(candidate.length).trim()
      if (!rest) {
        return {
          sku,
          quantity: null,
          unit: null,
          unitPrice: null,
          hasMacro: false,
        }
      }

      const quantityMatch =
        rest.match(/(?:^|\s)(?:x|\*)\s*(\d+(?:\.\d+)?)/i) ??
        rest.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:x\b)?/i)
      const unitMatch = rest.match(/(?:^|\s)\/([^\s@]+)/)
      const priceMatch = rest.match(/(?:^|\s)@(\d+(?:\.\d+)?)/)

      return {
        sku,
        quantity: quantityMatch?.[1] ?? null,
        unit: unitMatch?.[1] ?? null,
        unitPrice: priceMatch?.[1] ?? null,
        hasMacro: Boolean(quantityMatch || unitMatch || priceMatch),
      }
    }
  }

  return null
}
