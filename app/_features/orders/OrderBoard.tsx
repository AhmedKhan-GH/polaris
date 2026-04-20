'use client'

import { useEffect, useOptimistic, useState, useTransition } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createOrderAction } from './actions'
import { OrderColumn } from './OrderColumn'
import type { BoardCard } from './OrderCard'
import { getSupabaseClient } from '@/lib/supabase'
import { parseOrderRow, type Order } from '@/lib/domain/order'

function safeParseOrder(row: unknown, source: 'insert' | 'update'): Order | null {
  try {
    return parseOrderRow(row)
  } catch (err) {
    console.warn(`[OrderBoard] ignored malformed ${source} payload`, { row, err })
    return null
  }
}

function mergeById<T extends { id: string }>(list: T[], next: T): T[] {
  const index = list.findIndex((item) => item.id === next.id)
  if (index === -1) return [next, ...list]
  const copy = list.slice()
  copy[index] = next
  return copy
}

export function OrderBoard({ initial }: { initial: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(() =>
    [...initial].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  )
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
    <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6">
      <header className="shrink-0 flex items-center gap-4">
        <h1 className="text-xl font-semibold text-zinc-50">Orders</h1>
        <button
          type="button"
          onClick={handleCreateOrder}
          disabled={isCreating}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-opacity hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-40"
        >
          New Order
        </button>
      </header>

      <div className="flex-1 min-h-0 flex overflow-x-auto scrollbar-thin pb-2">
        <div className="flex flex-1 min-h-0 pr-4 items-stretch">
          <div className="flex min-h-0 flex-col gap-2">
            <span className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
              Submitted →
            </span>
            <OrderColumn name="Drafting" cards={optimistic} />
          </div>
          <div
            aria-hidden
            className="mx-4 w-0.5 shrink-0 self-stretch rounded-full bg-zinc-700"
          />
          <div className="flex min-h-0 flex-col gap-2">
            <span className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
              Invoiced →
            </span>
            <OrderColumn name="Reviewing" cards={[]} />
          </div>
          <div
            aria-hidden
            className="mx-4 w-0.5 shrink-0 self-stretch rounded-full bg-zinc-700"
          />
          <div className="flex min-h-0 flex-col gap-2">
            <span className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
              Closed →
            </span>
            <OrderColumn name="Fulfilling" cards={[]} />
          </div>
          <div
            aria-hidden
            className="mx-4 w-0.5 shrink-0 self-stretch rounded-full bg-zinc-700"
          />
          <div className="flex min-h-0 flex-col gap-2">
            <span aria-hidden className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-transparent whitespace-nowrap select-none">
              &nbsp;
            </span>
            <OrderColumn name="Archiving" cards={[]} />
          </div>
        </div>
      </div>
    </main>
  )
}
