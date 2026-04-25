import { db } from './db'
import { log } from './log'
import { orders } from './schema'

// Dev-only: impersonates another user by inserting a fresh order into
// Postgres every 5 seconds. Bypasses the server action on purpose ---
// the running browser sees these via realtime and prepends them like
// any other row. Useful for verifying multi-client fan-out locally.
//
// Run with: npm run sim:other-user. Ctrl+C to stop.

const INTERVAL_MS = 5_000

async function insertOne() {
  const [row] = await db.insert(orders).values({}).returning()
  log.info(
    { orderId: row.id, orderNumber: row.orderNumber },
    'other user created order',
  )
}

async function main() {
  log.info(
    { intervalMs: INTERVAL_MS },
    'simulating other-user creates; Ctrl+C to stop',
  )

  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    log.info('stopping simulator')
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  while (!stopping) {
    try {
      await insertOne()
    } catch (err) {
      log.error({ err }, 'insert failed; will retry on next tick')
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS))
  }

  await db.$client.end()
}

main().catch((err) => {
  log.error({ err }, 'simulator crashed')
  process.exit(1)
})
