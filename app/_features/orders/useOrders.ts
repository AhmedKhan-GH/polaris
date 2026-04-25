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

export interface UseOrdersResult {
  orders: Order[]
  isCreating: boolean
  createOrder: () => void
}

export function useOrders(initial: Order[]): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>(() =>
    sortOrdersNewestFirst(initial),
  )
  const [isCreating, setIsCreating] = useState(false)
  // Synchronous guard for back-to-back programmatic calls in the same
  // microtask --- the disabled button covers user clicks, but two
  // closures over pre-update state would both pass the `isCreating`
  // check. Not DOS protection; real throttling lives server-side.
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
    if (actionInFlight.current) return
    actionInFlight.current = true
    setIsCreating(true)
    try {
      // Realtime delivers the new tile via the INSERT handler above;
      // we discard the action's return value on purpose so there's
      // exactly one path that adds rows to local state.
      await createOrderAction()
    } finally {
      actionInFlight.current = false
      setIsCreating(false)
    }
  }

  return { orders, isCreating, createOrder }
}
