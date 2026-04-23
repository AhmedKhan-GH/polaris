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

type OptimisticAction =
  | { type: 'add'; card: BoardCard }
  | { type: 'finalize'; tempId: string }

function applyOptimistic(list: BoardCard[], action: OptimisticAction): BoardCard[] {
  if (action.type === 'add') return mergeById(list, action.card)
  // Drop the temp skeleton. The real card is delivered via setOrders (or
  // realtime) into the underlying `orders` state, so removing here is
  // enough --- re-inserting it in the optimistic layer would duplicate it.
  return list.filter((c) => c.id !== action.tempId)
}

export function OrderBoard({ initial }: { initial: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(() => sortOrdersNewestFirst(initial))
  const [optimistic, dispatchOptimistic] = useOptimistic<BoardCard[], OptimisticAction>(
    orders,
    applyOptimistic,
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
      // Temp id keys the optimistic skeleton until the server returns the
      // real row. After the action resolves we dispatch `finalize` so the
      // optimistic layer swaps the skeleton for the real card in place ---
      // without this, both would render during the transition tail.
      const tempId = crypto.randomUUID()
      const tempCard: BoardCard = {
        id: tempId,
        orderNumber: 0,
        createdAt: new Date(),
        pending: true,
      }
      dispatchOptimistic({ type: 'add', card: tempCard })
      const created = await createOrderAction()
      dispatchOptimistic({ type: 'finalize', tempId })
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
