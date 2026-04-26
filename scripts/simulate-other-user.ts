import { inArray, sql } from 'drizzle-orm'
import { db } from '../lib/db'
import { log } from '../lib/log'
import { orders } from '../lib/schema'
import {
  transitionOrderStatus,
  VALID_TRANSITIONS,
} from '../lib/db/orderRepository'
import { ACTIVE_ORDER_STATUSES } from '../lib/domain/order'

// Dev-only: impersonates another user against the local DB. Each tick
// the simulator either creates a fresh order or picks a random active
// order and walks it forward (or terminates it). Bypasses the server
// action on purpose --- the running browser sees these mutations via
// realtime, just like a real second client. Useful for verifying
// multi-client fan-out locally and for stress-testing the kanban /
// spreadsheet pushdown + indicator behavior.
//
// Run with: npm run sim:other-user. Ctrl+C to stop.

const INTERVAL_MS = 1_000
const CREATE_PROBABILITY = 0.1

async function insertOne() {
  const [row] = await db.insert(orders).values({}).returning()
  log.info(
    { orderId: row.id, orderNumber: row.orderNumber },
    'other user created order',
  )
}

async function transitionRandom() {
  const [candidate] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(inArray(orders.status, [...ACTIVE_ORDER_STATUSES]))
    .orderBy(sql`random()`)
    .limit(1)

  if (!candidate) {
    log.info('no active orders to transition; falling back to insert')
    await insertOne()
    return
  }

  const choices = VALID_TRANSITIONS[candidate.status]
  if (choices.length === 0) return
  const target = choices[Math.floor(Math.random() * choices.length)]

  const updated = await transitionOrderStatus({
    orderId: candidate.id,
    toStatus: target,
    changedBy: null,
    reason: 'simulator',
  })
  log.info(
    {
      orderId: candidate.id,
      from: candidate.status,
      to: updated.status,
    },
    'other user transitioned order',
  )
}

async function tick() {
  if (Math.random() < CREATE_PROBABILITY) {
    await insertOne()
  } else {
    await transitionRandom()
  }
}

async function main() {
  log.info(
    { intervalMs: INTERVAL_MS, createProbability: CREATE_PROBABILITY },
    'simulating other-user mutations; Ctrl+C to stop',
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
      await tick()
    } catch (err) {
      log.error({ err }, 'tick failed; will retry on next interval')
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS))
  }

  await db.$client.end()
}

main().catch((err) => {
  log.error({ err }, 'simulator crashed')
  process.exit(1)
})
