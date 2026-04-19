import { describe, expect, test } from 'vitest'
import { toOrder } from '@/lib/domain/order'

describe('toOrder', () => {
  const baseRow = {
    id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
    orderNumber: 1_000_000,
    createdAt: new Date('2026-04-19T12:00:00Z'),
  }

  test('maps every domain field from the row', () => {
    expect(toOrder(baseRow)).toEqual(baseRow)
  })

  test('keeps orderNumber as a number (no stringification)', () => {
    expect(typeof toOrder(baseRow).orderNumber).toBe('number')
  })

  test('preserves the Date instance for createdAt', () => {
    const result = toOrder(baseRow)
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.createdAt.getTime()).toBe(baseRow.createdAt.getTime())
  })

  test('drops unexpected columns so they cannot leak to callers', () => {
    const rowWithLeak = {
      ...baseRow,
      internalNote: 'do-not-expose',
      customerId: 'cust-42',
    } as unknown as typeof baseRow

    const result = toOrder(rowWithLeak)

    expect(Object.keys(result).sort()).toEqual(['createdAt', 'id', 'orderNumber'])
    expect(result).not.toHaveProperty('internalNote')
    expect(result).not.toHaveProperty('customerId')
  })
})
