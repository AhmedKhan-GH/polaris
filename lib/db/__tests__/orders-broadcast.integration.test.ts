import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { liveDbGate } from './live-db'

// The broadcast trigger + realtime.messages policy are Supabase-only (realtime
// schema). Runs against the live local Supabase DB, self-skips if unreachable.
// Run `supabase start` first. In CI the e2e job sets CI_REQUIRE_LIVE_DB so an
// unreachable DB hard-fails instead of skipping the per-topic isolation check.
const LIVE_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const REQUIRE_LIVE = !!process.env.CI_REQUIRE_LIVE_DB

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
    // Hard-fail in CI (CI_REQUIRE_LIVE_DB) instead of silently skipping.
    liveDbGate(reachable, REQUIRE_LIVE)
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

  // Channel authorization: as the `authenticated` role with auth.uid() = OWNER
  // and a subscription topic GUC, a user may read only their own topic.
  async function visibleTopicCount(sub: string, topic: string): Promise<number> {
    const client = await admin.connect()
    try {
      await client.query('begin')
      await client.query(`set local role authenticated`)
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub, role: 'authenticated' }),
      ])
      await client.query(`select set_config('realtime.topic', $1, true)`, [topic])
      const { rows } = await client.query<{ n: number }>(
        `select count(*)::int as n from realtime.messages where topic = $1`,
        [topic],
      )
      await client.query('rollback')
      return rows[0].n
    } finally {
      client.release()
    }
  }

  it('a user may read only their own orders topic', async ({ skip }) => {
    if (!reachable) return skip()
    const OTHER = '0a000000-0000-4000-8000-00000000aa99'
    // Own topic: visible (rows broadcast in the test above)
    expect(await visibleTopicCount(OWNER, `orders:${OWNER}`)).toBeGreaterThanOrEqual(1)
    // Another user's topic: denied → zero rows, even though they exist
    expect(await visibleTopicCount(OTHER, `orders:${OWNER}`)).toBe(0)
  })
})
