import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Order } from '../domain/order'

const { insertOrderMock, infoMock } = vi.hoisted(() => ({
  insertOrderMock: vi.fn(),
  infoMock: vi.fn(),
}))

vi.mock('../db/orderRepository', () => ({
  insertOrder: insertOrderMock,
}))

vi.mock('../log', () => ({
  log: {
    info: infoMock,
  },
}))

import { createOrder } from './orderService'

describe('createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns the inserted order and logs the creation event', async () => {
    const order: Order = {
      id: '7c16d5b1-6f83-45a2-9a9d-1f0dc1f1a2e4',
      orderNumber: 1_000_000,
      status: 'draft',
      statusUpdatedAt: new Date('2026-04-19T12:00:00Z'),
      duplicatedFromOrderId: null,
      createdAt: new Date('2026-04-19T12:00:00Z'),
    }
    insertOrderMock.mockResolvedValue(order)

    await expect(createOrder()).resolves.toEqual(order)

    expect(insertOrderMock).toHaveBeenCalledTimes(1)
    expect(infoMock).toHaveBeenCalledWith(
      { orderId: order.id, orderNumber: order.orderNumber },
      'order created',
    )
  })

  test('propagates repository errors without logging success', async () => {
    const error = new Error('db unavailable')
    insertOrderMock.mockRejectedValue(error)

    await expect(createOrder()).rejects.toThrow('db unavailable')

    expect(infoMock).not.toHaveBeenCalled()
  })
})
