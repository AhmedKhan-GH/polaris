'use client'

import { useEffect, useOptimistic, useState, useTransition } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createOrderAction } from './actions'
import { OrderBoardShell } from './OrderBoardShell'
import { OrderColumn } from './OrderColumn'
import type { BoardCard } from './OrderCard'
import { getSupabaseClient } from '@/lib/supabase'
import {
  mergeById,
  safeParseOrder,
  sortOrdersNewestFirst,
  type Order,
} from '@/lib/domain/order'

export function OrderBoard({ initial }: { initial: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(() => sortOrdersNewestFirst(initial))
  const [optimistic, addOptimistic] = useOptimistic<BoardCard[], BoardCard>(
    orders,
    mergeById,
  )
  const [isCreating, startCreate] = useTransition()

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
            setOrders((prev) =>
              prev.some((o) => o.id === incoming.id) ? prev : [incoming, ...prev],
            )
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

  function handleCreateOrder() {
    // Guard against overlapping server actions: each click fires a server
    // round-trip + route revalidation, so back-to-back spam-clicks stack
    // into parallel RSC rerenders. The transition's pending flag disables
    // the button between submission and resolution. User can still create
    // many orders --- just one in flight at a time.
    if (isCreating) return
    startCreate(async () => {
      // Client-generated UUID is the permanent id. The optimistic card and
      // the real row share a key, so React reconciles the skeleton card
      // into the final card in place --- no unmount/remount, no doubled
      // state.
      const id = crypto.randomUUID()
      addOptimistic({
        id,
        orderNumber: 0,
        createdAt: new Date(),
        pending: true,
      })
      const created = await createOrderAction(id)
      setOrders((prev) =>
        prev.some((o) => o.id === created.id) ? prev : [created, ...prev],
      )
    })
  }

  return (
    <OrderBoardShell
      headerAction={
        <button
          type="button"
          onClick={handleCreateOrder}
          disabled={isCreating}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-opacity hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-40"
        >
          New Order
        </button>
      }
      columns={[
        <OrderColumn key="drafting" name="Drafting" cards={optimistic} />,
        <OrderColumn key="reviewing" name="Reviewing" cards={[]} />,
        <OrderColumn key="fulfilling" name="Fulfilling" cards={[]} />,
        <OrderColumn key="archiving" name="Archiving" cards={[]} />,
      ]}
    />
  )
}
