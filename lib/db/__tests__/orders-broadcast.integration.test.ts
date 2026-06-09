import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'

// The broadcast trigger + realtime.messages policy are Supabase-only (realtime
// schema). Runs against the live local Supabase DB, self-skips if unreachable.
// Run `supabase start` first.
const LIVE_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const OWNER = '0a000000-0000-4000-8000-00000000aa01'

describe('orders broadcast trigger', () => {
  let admin: pg.Pool
  let reachable = false
  let orderId: string | null = null

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: LIVE_DB, connectionTimeoutMillis: 1500 })
    try {
      await admin.query('select 1')
      reachable = true
    } catch {
      reachable = false
    }
  }, 60_000)

  afterAll(async () => {
    if (reachable) {
      if (orderId) await admin.query(`delete from orders where id = $1`, [orderId])
      await admin.query(`delete from realtime.messages where topic = any($1)`, [
        [`orders:${OWNER}`, 'orders:all'],
      ])
    }
    await admin?.end()
  })

  it('inserting an order broadcasts to the owner topic and the firehose', async ({
    skip,
  }) => {
    if (!reachable) return skip()
    const { rows } = await admin.query<{ id: string }>(
      `insert into orders (created_by) values ($1::uuid) returning id`,
      [OWNER],
    )
    orderId = rows[0].id

    const owner = await admin.query(
      `select count(*)::int as n from realtime.messages where topic = $1`,
      [`orders:${OWNER}`],
    )
    const all = await admin.query(
      `select count(*)::int as n from realtime.messages where topic = 'orders:all'`,
    )
    expect(owner.rows[0].n).toBeGreaterThanOrEqual(1)
    expect(all.rows[0].n).toBeGreaterThanOrEqual(1)
  })
})
