'use client'

import { useEffect, useOptimistic, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createOrderAction } from './actions'
import { OrderColumn } from './OrderColumn'
import type { BoardCard } from './OrderCard'
import { getSupabaseClient } from '@/lib/supabase'
import { parseOrderRow, type Order } from '@/lib/domain/order'

const COLUMNS = ['Drafting', 'Reviewing', 'Invoicing', 'Archiving'] as const

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
    // Client-generated UUID is the permanent id. The optimistic card and the
    // real row share a key, so React reconciles the `…` card into the final
    // card in place --- no unmount/remount, no doubled state.
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
          {COLUMNS.map((column) => (
            <OrderColumn
              key={column}
              name={column}
              cards={column === 'Drafting' ? optimistic : []}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
