import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import path from 'node:path'

const MIGRATIONS_FOLDER = path.resolve(__dirname, '..', '..', 'drizzle')

describe('orderLineItemRepository (integration)', () => {
  let container: StartedPostgreSqlContainer
  let pool: Pool
  let lineItemRepo: typeof import('./orderLineItemRepository')
  let orderRepo: typeof import('./orderRepository')
  let appDb: typeof import('../db')

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()

    process.env.DATABASE_URL = container.getConnectionUri()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    pool = new Pool({ connectionString: container.getConnectionUri() })
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })

    vi.resetModules()
    lineItemRepo = await import('./orderLineItemRepository')
    orderRepo = await import('./orderRepository')
    appDb = await import('../db')
  })

  afterAll(async () => {
    await appDb?.db.$client.end()
    await pool?.end()
    await container?.stop()
  })

  afterEach(async () => {
    await pool.query('TRUNCATE TABLE orders, order_status_history, skus CASCADE')
    await pool.query('UPDATE order_status_counts SET count = 0')
    await pool.query('ALTER SEQUENCE order_number_seq RESTART WITH 1000000')
  })

  test('findActiveSkuOptions returns active SKUs in catalog order', async () => {
    const cherry = await lineItemRepo.insertSku({
      skuNumber: 'SKU-CHERRY',
      name: 'Cherry',
      defaultUnit: 'case',
    })
    const apple = await lineItemRepo.insertSku({
      skuNumber: 'SKU-APPLE',
      name: 'Apple',
      defaultUnit: null,
    })

    await pool.query(
      'INSERT INTO skus (sku_number, name, is_active) VALUES ($1, $2, false)',
      ['SKU-BANANA', 'Banana'],
    )

    await expect(lineItemRepo.findActiveSkuOptions()).resolves.toEqual([
      apple,
      cherry,
    ])
  })

  test('creates line items and reads them with SKU details in line order', async () => {
    const order = await orderRepo.insertOrder()
    const soda = await lineItemRepo.insertSku({
      skuNumber: 'SKU-SODA',
      name: 'Soda',
      defaultUnit: 'case',
    })
    const tea = await lineItemRepo.insertSku({
      skuNumber: 'SKU-TEA',
      name: 'Tea',
      defaultUnit: 'unit',
    })

    const first = await lineItemRepo.insertOrderLineItem({
      orderId: order.id,
      skuId: soda.id,
      quantity: 2,
      unit: 'case',
      unitPrice: 19.5,
      notes: 'Keep cold',
    })
    const second = await lineItemRepo.insertOrderLineItem({
      orderId: order.id,
      skuId: tea.id,
      quantity: 12,
      unit: 'unit',
    })

    expect(first).toMatchObject({
      orderId: order.id,
      skuId: soda.id,
      skuNumber: soda.skuNumber,
      skuName: soda.name,
      lineNumber: 1,
      quantity: 2,
      unit: 'case',
      unitPrice: 19.5,
      notes: 'Keep cold',
    })
    expect(second).toMatchObject({
      orderId: order.id,
      skuId: tea.id,
      lineNumber: 2,
      quantity: 12,
      unitPrice: null,
      notes: null,
    })

    const lineItems = await lineItemRepo.findOrderLineItems(order.id)

    expect(lineItems.map((lineItem) => lineItem.id)).toEqual([
      first.id,
      second.id,
    ])
  })

  test('updates a line item only through its owning order', async () => {
    const order = await orderRepo.insertOrder()
    const otherOrder = await orderRepo.insertOrder()
    const sku = await lineItemRepo.insertSku({
      skuNumber: 'SKU-COFFEE',
      name: 'Coffee',
      defaultUnit: 'case',
    })
    const lineItem = await lineItemRepo.insertOrderLineItem({
      orderId: order.id,
      skuId: sku.id,
      quantity: 1,
      unit: 'case',
    })

    await expect(
      lineItemRepo.updateOrderLineItem({
        id: lineItem.id,
        orderId: otherOrder.id,
        quantity: 9,
        unit: 'pallet',
      }),
    ).resolves.toBeNull()

    const updated = await lineItemRepo.updateOrderLineItem({
      id: lineItem.id,
      orderId: order.id,
      quantity: 3.5,
      unit: 'case',
      unitPrice: 44,
      notes: 'Rush',
    })

    expect(updated).toMatchObject({
      id: lineItem.id,
      quantity: 3.5,
      unit: 'case',
      unitPrice: 44,
      notes: 'Rush',
    })
  })

  test('deletes a line item only through its owning order', async () => {
    const order = await orderRepo.insertOrder()
    const otherOrder = await orderRepo.insertOrder()
    const sku = await lineItemRepo.insertSku({
      skuNumber: 'SKU-JUICE',
      name: 'Juice',
      defaultUnit: 'case',
    })
    const lineItem = await lineItemRepo.insertOrderLineItem({
      orderId: order.id,
      skuId: sku.id,
      quantity: 4,
      unit: 'case',
    })

    await expect(
      lineItemRepo.deleteOrderLineItem({
        id: lineItem.id,
        orderId: otherOrder.id,
      }),
    ).resolves.toBeNull()
    await expect(lineItemRepo.findOrderLineItems(order.id)).resolves.toHaveLength(1)

    await expect(
      lineItemRepo.deleteOrderLineItem({
        id: lineItem.id,
        orderId: order.id,
      }),
    ).resolves.toEqual({
      id: lineItem.id,
      orderId: order.id,
    })
    await expect(lineItemRepo.findOrderLineItems(order.id)).resolves.toEqual([])
  })
})
