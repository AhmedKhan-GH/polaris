'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/browser'

export type OrderRow = { id: string; createdBy: string; createdAt: string }

// Subscribe to the caller's private orders topic and merge live INSERTs into the
// list. Per-user scoping is enforced server-side by the realtime.messages policy;
// the topic name here must match the broadcast topic (drizzle/0009).
export function useOrdersRealtime(userId: string, initial: OrderRow[]): OrderRow[] {
  const [rows, setRows] = useState<OrderRow[]>(initial)

  useEffect(() => {
    const supabase = getSupabaseClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    void (async () => {
      // Private channels require the session token on the realtime socket.
      await supabase.realtime.setAuth()
      channel = supabase
        .channel(`orders:${userId}`, { config: { private: true } })
        .on('broadcast', { event: 'INSERT' }, ({ payload }) => {
          const r = (payload as { record: { id: string; created_by: string; created_at: string } })
            .record
          setRows((prev) =>
            prev.some((o) => o.id === r.id)
              ? prev
              : [
                  { id: r.id, createdBy: r.created_by, createdAt: r.created_at },
                  ...prev,
                ],
          )
        })
        .subscribe()
    })()

    return () => {
      if (channel) void supabase.removeChannel(channel)
    }
  }, [userId])

  return rows
}
