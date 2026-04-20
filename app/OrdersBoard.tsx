'use client'

import { useEffect, useOptimistic, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createOrderAction } from './actions'
import { getSupabaseClient } from '@/lib/supabase'
import { parseOrderRow, type Order } from '@/lib/domain/order'

const COLUMNS = ['Drafting', 'Reviewing', 'Invoicing', 'Archiving'] as const

type OrderTile = Order & { pending?: boolean }

function safeParseOrder(row: unknown, source: 'insert' | 'update'): Order | null {
  try {
    return parseOrderRow(row)
  } catch (err) {
    console.warn(`[OrdersBoard] ignored malformed ${source} payload`, { row, err })
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

export function OrdersBoard({ initial }: { initial: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(() =>
    [...initial].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  )
  const [optimistic, addOptimistic] = useOptimistic<OrderTile[], OrderTile>(
    orders,
    mergeById,
  )

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

  async function handleCreateOrder() {
    // Client-generated UUID is the permanent id. The optimistic tile and the
    // real row share a key, so React reconciles the `…` tile into the final
    // tile in place --- no unmount/remount, no doubled state.
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
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6">
      <header className="shrink-0 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-50">Orders</h1>
        <form action={handleCreateOrder}>
          <button
            type="submit"
            className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            New Order
          </button>
        </form>
      </header>

      <div className="flex-1 min-h-0 flex overflow-x-auto scrollbar-thin pb-2">
        <div className="flex gap-4 pr-4">
          {COLUMNS.map((column) => {
            const tiles = column === 'Drafting' ? optimistic : []
            return (
              <section
                key={column}
                className="flex w-64 shrink-0 min-h-0 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
              >
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    {column}
                  </h2>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                    {tiles.length}
                  </span>
                </div>
                <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin">
                  {tiles.map((order) => (
                    <li
                      key={order.id}
                      className={
                        'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm font-medium text-zinc-50 transition-opacity ' +
                        (order.pending ? 'opacity-50' : 'opacity-100')
                      }
                    >
                      {order.pending ? '…' : order.orderNumber}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </main>
  )
}
