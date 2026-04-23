'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createOrderAction } from './actions'
import { getSupabaseClient } from '@/lib/supabase'
import {
  safeParseOrder,
  sortOrdersNewestFirst,
  type Order,
} from '@/lib/domain/order'

// `pending` is a per-row signal: the row exists in the list but its
// server data hasn't landed yet. Views render it as a skeleton and
// replace in-place once realtime echoes the real columns. Same shape
// supports future cases like "row is reloading on slow connection".
export type OrderWithPending = Order & { pending?: boolean }

// `crypto.randomUUID()` is only defined in secure contexts (HTTPS or
// localhost). When the dev server is reached over plain HTTP from a
// LAN IP or tunnel, it's undefined. `crypto.getRandomValues` is
// available everywhere, so we synthesize a v4 UUID ourselves as a
// fallback. Output is byte-for-byte equivalent to randomUUID().
function makeUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface UseOrdersResult {
  orders: OrderWithPending[]
  isCreating: boolean
  createOrder: () => void
}

export function useOrders(initial: Order[]): UseOrdersResult {
  const [orders, setOrders] = useState<OrderWithPending[]>(() =>
    sortOrdersNewestFirst(initial),
  )
  // Ref-guard covers two cases the React state can't:
  //   - rapid clicks in a single render (both closures see the same
  //     pre-placeholder `orders`, so the state check below passes twice)
  //   - programmatic calls fired in the same microtask before re-render
  // Client-side only --- not DOS protection. Hostile clients can hit
  // the server action directly; real throttling has to live server-side.
  const actionInFlight = useRef(false)

  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('orders-board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === 'INSERT') {
            const incoming = safeParseOrder(payload.new, 'insert')
            if (!incoming) return
            const correlationId =
              typeof payload.new.client_correlation_id === 'string'
                ? payload.new.client_correlation_id
                : null
            setOrders((prev) => {
              // 1) Row already present under its real id — either the
              //    action beat us here and upgraded the placeholder,
              //    or this is a redundant echo. Overwrite in place.
              const byId = prev.findIndex((o) => o.id === incoming.id)
              if (byId >= 0) {
                const copy = prev.slice()
                copy[byId] = incoming
                return copy
              }
              // 2) Our pending placeholder is still keyed by the
              //    client-minted tempId that we also sent as the
              //    correlation token. If the incoming payload carries
              //    that same token, this is the echo of OUR create ---
              //    adopt it in place so the skeleton morphs into the
              //    real card without a brief double-render.
              if (correlationId) {
                const byCorr = prev.findIndex(
                  (o) => o.id === correlationId && o.pending,
                )
                if (byCorr >= 0) {
                  const copy = prev.slice()
                  copy[byCorr] = incoming
                  return copy
                }
              }
              // 3) Someone else's create. Prepend.
              return [incoming, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const incoming = safeParseOrder(payload.new, 'update')
            if (!incoming) return
            setOrders((prev) =>
              prev.map((o) => (o.id === incoming.id ? incoming : o)),
            )
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id
            if (!oldId) return
            setOrders((prev) => prev.filter((o) => o.id !== oldId))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  async function createOrder() {
    // Block if either: an action is in flight (ref), or a prior
    // placeholder is still awaiting realtime (state). Together these
    // cover the full loading window, not just the await itself.
    if (actionInFlight.current || orders.some((o) => o.pending)) return
    actionInFlight.current = true
    const tempId = makeUuid()
    setOrders((prev) => [
      {
        id: tempId,
        orderNumber: 0,
        createdAt: new Date(),
        pending: true,
      },
      ...prev,
    ])
    try {
      // `tempId` does double duty: it's the placeholder's local primary
      // key (React key) AND the correlation token we send the server.
      // The server stores it as `client_correlation_id` on the row;
      // realtime echoes it back; our INSERT handler uses it to adopt
      // this placeholder in place even when realtime beats the action.
      const created = await createOrderAction(tempId)
      // Upgrade the placeholder with authoritative server data. Two cases:
      //   - realtime beat us (row is already present under realId):
      //     drop the stale tempId placeholder so it doesn't duplicate
      //   - realtime hasn't arrived yet: replace the placeholder
      //     in-place with the real row. `pending` drops out because
      //     `created` is a plain Order with no pending field. A later
      //     realtime echo is idempotent (findIndex+overwrite).
      // Doing the upgrade here — instead of waiting for realtime to
      // clear `pending` — means a missed/late realtime event can't
      // leave the row stuck in a loading state.
      setOrders((prev) => {
        if (prev.some((o) => o.id === created.id)) {
          return prev.filter((o) => o.id !== tempId)
        }
        return prev.map((o) => (o.id === tempId ? created : o))
      })
    } catch (err) {
      setOrders((prev) => prev.filter((o) => o.id !== tempId))
      throw err
    } finally {
      actionInFlight.current = false
    }
  }

  // `isCreating` reflects *visible* loading state, not just whether the
  // server action is in flight. It stays true through the post-action
  // phase while the placeholder waits for realtime to deliver real data
  // — so the button's disabled styling matches what the user sees.
  const isCreating = orders.some((o) => o.pending)

  return { orders, isCreating, createOrder }
}
