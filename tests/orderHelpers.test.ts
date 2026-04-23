import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  mergeById,
  safeParseOrder,
  sortOrdersNewestFirst,
} from '@/lib/domain/order'

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

  test('returns empty array for empty input', () => {
    expect(sortOrdersNewestFirst([])).toEqual([])
  })
})

describe('mergeById', () => {
  const a = { id: 'a', value: 1 }
  const b = { id: 'b', value: 2 }
  const c = { id: 'c', value: 3 }

  test('prepends when id is not in list', () => {
    expect(mergeById([a, b], c)).toEqual([c, a, b])
  })

  test('replaces in place when id already exists', () => {
    const updated = { id: 'a', value: 99 }
    expect(mergeById([a, b], updated)).toEqual([updated, b])
  })

  test('prepends when list is empty', () => {
    expect(mergeById([], a)).toEqual([a])
  })

  test('does not mutate the input list', () => {
    const list = [a, b]
    mergeById(list, c)
    expect(list).toEqual([a, b])
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
    const result = safeParseOrder(
      {
        id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
        order_number: '1000001',
        created_at: '2026-04-19T12:00:00Z',
      },
      'insert',
    )

    expect(result).toEqual({
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
    const message = warnSpy.mock.calls[0]?.[0] as string
    expect(message).toContain('update')
  })
})
