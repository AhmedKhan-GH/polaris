'use client'

import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/browser'
import { findOrderLineItemsAction } from './actions'
import {
  LIST_ORDERS_QUERY_KEY,
  ORDERS_QUERY_KEY,
  orderLineItemsQueryKey,
} from './queryKeys'

export function useOrderLineItemRows(
  orderId: string,
  { subscribe = true }: { subscribe?: boolean } = {},
) {
  const queryClient = useQueryClient()

  const lineItems = useQuery({
    queryKey: orderLineItemsQueryKey(orderId),
    queryFn: () => findOrderLineItemsAction(orderId),
  })

  const refreshLineItems = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: orderLineItemsQueryKey(orderId),
    })
    // Order rows can carry compact line-item summaries in some views.
    void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: LIST_ORDERS_QUERY_KEY })
  }, [orderId, queryClient])

  useEffect(() => {
    if (!subscribe) return
    const supabase = getSupabaseClient()
    let cancelled = false
    let activeChannel: ReturnType<typeof supabase.channel> | null = null

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled || !session) return

      const channelToken = Math.random().toString(36).slice(2)
      activeChannel = supabase
        .channel(`order-line-items:${orderId}:${channelToken}`, {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_line_items',
            filter: `order_id=eq.${orderId}`,
          },
          refreshLineItems,
        )
        .subscribe()
    }

    void subscribe()

    return () => {
      cancelled = true
      if (activeChannel) void supabase.removeChannel(activeChannel)
    }
  }, [orderId, refreshLineItems, subscribe])

  return {
    lineItems: lineItems.data ?? [],
    isLoading: lineItems.isLoading,
    error: lineItems.error,
    refreshLineItems,
  }
}
