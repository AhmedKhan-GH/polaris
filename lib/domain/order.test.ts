import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  dedupeById,
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
    status: 'drafted' as const,
    statusUpdatedAt: Date.UTC(2026, 3, 19, 12, 0, 0),
    duplicatedFromOrderId: null,
    createdAt: Date.UTC(2026, 3, 19, 12, 0, 0),
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
  const tsMs = Date.UTC(2026, 3, 19, 12, 0, 0)
  const validRow = {
    id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
    order_number: '1000001',
    status: 'drafted',
    status_updated_at: tsMs,
    duplicated_from_order_id: null,
    created_at: tsMs,
  }

  test('converts a raw row into an Order', () => {
    expect(parseOrderRow(validRow)).toEqual({
      id: validRow.id,
      orderNumber: 1_000_001,
      status: 'drafted',
      statusUpdatedAt: tsMs,
      duplicatedFromOrderId: null,
      createdAt: tsMs,
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

  test('coerces a stringified bigint timestamp', () => {
    expect(
      parseOrderRow({ ...validRow, created_at: String(tsMs) }).createdAt,
    ).toBe(tsMs)
  })

  test('throws on an invalid UUID', () => {
    expect(() => parseOrderRow({ ...validRow, id: 'not-a-uuid' })).toThrow()
  })

  test('rejects an unknown status', () => {
    expect(() => parseOrderRow({ ...validRow, status: 'paid' })).toThrow()
  })

  test.each([
    'id',
    'order_number',
    'status',
    'status_updated_at',
    'duplicated_from_order_id',
    'created_at',
  ] as const)('throws when required field %s is missing', (field) => {
    const partial: Record<string, unknown> = { ...validRow }
    delete partial[field]
    expect(() => parseOrderRow(partial)).toThrow()
  })
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
    const tsMs = Date.UTC(2026, 3, 19, 12, 0, 0)
    expect(
      safeParseOrder(
        {
          id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
          order_number: '1000001',
          status: 'drafted',
          status_updated_at: tsMs,
          duplicated_from_order_id: null,
          created_at: tsMs,
        },
        'insert',
      ),
    ).toEqual({
      id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
      orderNumber: 1_000_001,
      status: 'drafted',
      statusUpdatedAt: tsMs,
      duplicatedFromOrderId: null,
      createdAt: tsMs,
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
    createdAt: Date.UTC(2026, 3, 19, 10, 0, 0),
  }
  const middle = {
    id: 'b',
    orderNumber: 2,
    createdAt: Date.UTC(2026, 3, 19, 11, 0, 0),
  }
  const newest = {
    id: 'c',
    orderNumber: 3,
    createdAt: Date.UTC(2026, 3, 19, 12, 0, 0),
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

describe('dedupeById', () => {
  test('keeps the first occurrence of each id and drops later duplicates', () => {
    const firstA = { id: 'a', value: 1 }
    const firstB = { id: 'b', value: 2 }
    const secondA = { id: 'a', value: 3 }

    expect(dedupeById([firstA, firstB, secondA])).toEqual([firstA, firstB])
  })

  test('does not mutate the input list', () => {
    const list = [{ id: 'a', value: 1 }, { id: 'a', value: 2 }]
    dedupeById(list)
    expect(list).toEqual([{ id: 'a', value: 1 }, { id: 'a', value: 2 }])
  })
})

describe('formatCreatedAt', () => {
  test('renders an instant in the supplied IANA timezone, 24-hour', () => {
    // 2026-04-19T16:30:00Z is 12:30 in America/New_York (EDT, UTC-4)
    expect(
      formatCreatedAt(Date.UTC(2026, 3, 19, 16, 30, 0), 'America/New_York'),
    ).toBe('2026-04-19 · 12:30:00')
  })

  test('renders the same instant differently in a different zone', () => {
    const ms = Date.UTC(2026, 3, 19, 16, 30, 0)
    expect(formatCreatedAt(ms, 'UTC')).toBe('2026-04-19 · 16:30:00')
    expect(formatCreatedAt(ms, 'Asia/Tokyo')).toBe('2026-04-20 · 01:30:00')
  })

  test('appends AM/PM when hour12 is true', () => {
    const ms = Date.UTC(2026, 3, 19, 16, 30, 0)
    expect(formatCreatedAt(ms, 'UTC', true)).toBe('2026-04-19 · 04:30:00 PM')
    expect(formatCreatedAt(ms, 'America/New_York', true)).toBe(
      '2026-04-19 · 12:30:00 PM',
    )
  })

  test('renders midnight as 12:00:00 AM in 12h mode (h12 cycle)', () => {
    expect(formatCreatedAt(Date.UTC(2026, 3, 19, 0, 0, 0), 'UTC', true)).toBe(
      '2026-04-19 · 12:00:00 AM',
    )
  })

  test('renders midnight as 00:00:00 in 24h mode (h23 cycle)', () => {
    expect(formatCreatedAt(Date.UTC(2026, 3, 19, 0, 0, 0), 'UTC')).toBe(
      '2026-04-19 · 00:00:00',
    )
  })
})
