import { describe, expect, it } from 'vitest'
import type { SkuOption } from '@/lib/domain/orderLineItem'
import { findSkuFromInput, parseEntryMacro } from './entryMacro'

const SKUS: SkuOption[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    skuNumber: 'QA-APPLE',
    name: 'Apples',
    defaultUnit: 'case',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    skuNumber: 'QA-APPLE-SAUCE',
    name: 'Apple Sauce',
    defaultUnit: 'jar',
  },
]

describe('entry macros', () => {
  it('matches exact SKU labels, numbers, and names', () => {
    expect(findSkuFromInput('QA-APPLE', SKUS)?.name).toBe('Apples')
    expect(findSkuFromInput('apples', SKUS)?.skuNumber).toBe('QA-APPLE')
    expect(findSkuFromInput('QA-APPLE - Apples', SKUS)?.id).toBe(SKUS[0].id)
  })

  it('parses quantity, unit, and unit price hints', () => {
    const macro = parseEntryMacro('QA-APPLE x2 /box @3.50', SKUS)

    expect(macro).toMatchObject({
      sku: SKUS[0],
      quantity: '2',
      unit: 'box',
      unitPrice: '3.50',
      hasMacro: true,
    })
  })

  it('prefers the longest matching SKU when one number prefixes another', () => {
    const macro = parseEntryMacro('QA-APPLE-SAUCE x4', SKUS)

    expect(macro?.sku).toBe(SKUS[1])
    expect(macro?.quantity).toBe('4')
  })

  it('returns an exact SKU match without treating it as a macro', () => {
    expect(parseEntryMacro('QA-APPLE', SKUS)).toMatchObject({
      sku: SKUS[0],
      quantity: null,
      unit: null,
      unitPrice: null,
      hasMacro: false,
    })
  })

  it('returns null for unknown input', () => {
    expect(parseEntryMacro('NOPE x2', SKUS)).toBeNull()
  })
})
