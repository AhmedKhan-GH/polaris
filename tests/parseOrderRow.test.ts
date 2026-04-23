import { describe, expect, test } from 'vitest'
import { parseOrderRow } from '@/lib/domain/order'

const validRow = {
  id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
  order_number: '1000001',
  created_at: '2026-04-19T12:00:00Z',
}

describe('parseOrderRow', () => {
  test('maps snake_case fields to camelCase domain shape', () => {
    const order = parseOrderRow(validRow)
    expect(order).toEqual({
      id: validRow.id,
      orderNumber: 1_000_001,
      createdAt: new Date('2026-04-19T12:00:00Z'),
    })
  })

  test('accepts numeric order_number', () => {
    const order = parseOrderRow({ ...validRow, order_number: 1_000_001 })
    expect(order.orderNumber).toBe(1_000_001)
  })

  test('converts created_at ISO string to a Date instance', () => {
    const order = parseOrderRow(validRow)
    expect(order.createdAt).toBeInstanceOf(Date)
    expect(order.createdAt.getTime()).toBe(new Date('2026-04-19T12:00:00Z').getTime())
  })

  test('throws on invalid UUID', () => {
    expect(() => parseOrderRow({ ...validRow, id: 'not-a-uuid' })).toThrow()
  })

  test.each(['id', 'order_number', 'created_at'] as const)(
    'throws when required field %s is missing',
    (field) => {
      const partial: Record<string, unknown> = { ...validRow }
      delete partial[field]
      expect(() => parseOrderRow(partial)).toThrow()
    },
  )
})
