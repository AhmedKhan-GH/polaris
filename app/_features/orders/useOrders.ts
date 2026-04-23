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
            setOrders((prev) => {
              const idx = prev.findIndex((o) => o.id === incoming.id)
              if (idx >= 0) {
                // The row is already in the list — most commonly a
                // pending placeholder whose tempId was swapped to this
                // realId when the server action resolved. Overwriting
                // with the realtime payload drops the `pending` flag
                // and fills in the real orderNumber/createdAt in place.
                const copy = prev.slice()
                copy[idx] = incoming
                return copy
              }
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
    const tempId = crypto.randomUUID()
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
      const created = await createOrderAction()
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
