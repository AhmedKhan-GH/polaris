import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  formatCreatedAt,
  mergeById,
  parseOrderRow,
  safeParseOrder,
  sortOrdersNewestFirst,
  toOrder,
} from './order'

describe('toOrder', () => {
  const baseRow = {
    id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
    orderNumber: 1_000_000,
    createdAt: new Date('2026-04-19T12:00:00Z'),
  }

  test('maps every domain field from the row', () => {
    expect(toOrder(baseRow)).toEqual(baseRow)
  })

  test('keeps orderNumber as a number', () => {
    expect(typeof toOrder(baseRow).orderNumber).toBe('number')
  })

  test('drops unexpected columns so they cannot leak to callers', () => {
    const rowWithExtraFields = {
      ...baseRow,
      internalNote: 'do-not-expose',
      customerId: 'cust-42',
    } as unknown as typeof baseRow

    expect(toOrder(rowWithExtraFields)).toEqual(baseRow)
  })
})

describe('parseOrderRow', () => {
  const validRow = {
    id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
    order_number: '1000001',
    created_at: '2026-04-19T12:00:00Z',
  }

  test('converts a raw row into an Order', () => {
    expect(parseOrderRow(validRow)).toEqual({
      id: validRow.id,
      orderNumber: 1_000_001,
      createdAt: new Date('2026-04-19T12:00:00Z'),
    })
  })

  test('accepts a numeric order_number', () => {
    expect(
      parseOrderRow({
        ...validRow,
        order_number: 1_000_001,
      }).orderNumber,
    ).toBe(1_000_001)
  })

  test('throws on an invalid UUID', () => {
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

describe('safeParseOrder', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  test('returns the parsed order for a valid row', () => {
    expect(
      safeParseOrder(
        {
          id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
          order_number: '1000001',
          created_at: '2026-04-19T12:00:00Z',
        },
        'insert',
      ),
    ).toEqual({
      id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
      orderNumber: 1_000_001,
      createdAt: new Date('2026-04-19T12:00:00Z'),
    })
  })

  test('returns null for a malformed row', () => {
    expect(safeParseOrder({ id: 'not-a-uuid' }, 'insert')).toBeNull()
  })

  test.each([null, undefined, 'not-an-object', 42, []])(
    'returns null without throwing for %p',
    (value) => {
      expect(() => safeParseOrder(value, 'update')).not.toThrow()
      expect(safeParseOrder(value, 'update')).toBeNull()
    },
  )

  test('warns with the source label on parse failure', () => {
    safeParseOrder({ bad: 'data' }, 'update')

    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0]?.[0]).toContain('update')
  })
})

describe('sortOrdersNewestFirst', () => {
  const older = {
    id: 'a',
    orderNumber: 1,
    createdAt: new Date('2026-04-19T10:00:00Z'),
  }
  const middle = {
    id: 'b',
    orderNumber: 2,
    createdAt: new Date('2026-04-19T11:00:00Z'),
  }
  const newest = {
    id: 'c',
    orderNumber: 3,
    createdAt: new Date('2026-04-19T12:00:00Z'),
  }

  test('sorts orders by createdAt descending', () => {
    expect(sortOrdersNewestFirst([older, newest, middle])).toEqual([
      newest,
      middle,
      older,
    ])
  })

  test('does not mutate the input array', () => {
    const input = [older, newest]
    sortOrdersNewestFirst(input)
    expect(input).toEqual([older, newest])
  })

  test('returns an empty array for empty input', () => {
    expect(sortOrdersNewestFirst([])).toEqual([])
  })
})

describe('mergeById', () => {
  const a = { id: 'a', value: 1 }
  const b = { id: 'b', value: 2 }
  const c = { id: 'c', value: 3 }

  test('prepends when the id is not in the list', () => {
    expect(mergeById([a, b], c)).toEqual([c, a, b])
  })

  test('replaces an existing item in place when the id already exists', () => {
    const updated = { id: 'a', value: 99 }
    expect(mergeById([a, b], updated)).toEqual([updated, b])
  })

  test('does not mutate the input list', () => {
    const list = [a, b]
    mergeById(list, c)
    expect(list).toEqual([a, b])
  })
})

describe('formatCreatedAt', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('uses pinned locale options and joins the date and time parts', () => {
    const dateSpy = vi
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('Apr 19, 2026')
    const timeSpy = vi
      .spyOn(Date.prototype, 'toLocaleTimeString')
      .mockReturnValue('12:00:00')

    expect(formatCreatedAt(new Date('2026-04-19T12:00:00Z'))).toBe(
      'Apr 19, 2026 · 12:00:00',
    )

    expect(dateSpy).toHaveBeenCalledWith('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    expect(timeSpy).toHaveBeenCalledWith('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  })

  test('does not mutate the input Date', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Apr 19, 2026')
    vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('12:00:00')

    const input = new Date('2026-04-19T12:00:00Z')
    const before = input.getTime()

    formatCreatedAt(input)

    expect(input.getTime()).toBe(before)
  })
})
