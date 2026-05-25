'use client'

import { useCallback, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/browser'
import {
  createOrderLineItemAction,
  createSkuAction,
  deleteOrderLineItemAction,
  findOrderLineItemsAction,
  findSkuOptionsAction,
  updateOrderLineItemAction,
} from './actions'
import {
  ORDERS_QUERY_KEY,
  SKU_OPTIONS_QUERY_KEY,
  orderLineItemsQueryKey,
} from './queryKeys'

function optionalPrice(value: string): number | null {
  const normalized = value.trim()
  if (!normalized) return null
  return Number(normalized)
}

export function useOrderLineItems(orderId: string) {
  const queryClient = useQueryClient()

  const lineItems = useQuery({
    queryKey: orderLineItemsQueryKey(orderId),
    queryFn: () => findOrderLineItemsAction(orderId),
  })

  const skuOptions = useQuery({
    queryKey: SKU_OPTIONS_QUERY_KEY,
    queryFn: () => findSkuOptionsAction(),
  })

  const refreshLineItems = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: orderLineItemsQueryKey(orderId),
    })
    // Order rows carry a compact SKU summary for the list view.
    void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
  }, [orderId, queryClient])

  useEffect(() => {
    const supabase = getSupabaseClient()
    let cancelled = false
    let activeChannel: ReturnType<typeof supabase.channel> | null = null

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled || !session) return

      activeChannel = supabase
        .channel(`order-line-items:${orderId}`, { config: { private: true } })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_line_items',
            filter: `order_id=eq.${orderId}`,
          },
          () => {
            refreshLineItems()
          },
        )
        .subscribe()
    }

    void subscribe()

    return () => {
      cancelled = true
      if (activeChannel) void supabase.removeChannel(activeChannel)
    }
  }, [orderId, queryClient, refreshLineItems])

  const createLineItem = useMutation({
    mutationFn: (args: {
      skuId: string
      quantity: string
      unit: string
      unitPrice: string
    }) =>
      createOrderLineItemAction({
        orderId,
        skuId: args.skuId,
        quantity: Number(args.quantity),
        unit: args.unit,
        unitPrice: optionalPrice(args.unitPrice),
      }),
    onSuccess: refreshLineItems,
  })

  const updateLineItem = useMutation({
    mutationFn: (args: {
      lineItemId: string
      quantity: string
      unit: string
      unitPrice: string
    }) =>
      updateOrderLineItemAction({
        orderId,
        lineItemId: args.lineItemId,
        quantity: Number(args.quantity),
        unit: args.unit,
        unitPrice: optionalPrice(args.unitPrice),
      }),
    onSuccess: refreshLineItems,
  })

  const removeLineItem = useMutation({
    mutationFn: (lineItemId: string) =>
      deleteOrderLineItemAction({ orderId, lineItemId }),
    onSuccess: refreshLineItems,
  })

  const createSku = useMutation({
    mutationFn: createSkuAction,
    onSuccess: (sku) => {
      queryClient.setQueryData(
        SKU_OPTIONS_QUERY_KEY,
        (old: typeof skuOptions.data) =>
          old ? [...old, sku].sort((a, b) => a.skuNumber.localeCompare(b.skuNumber)) : [sku],
      )
    },
  })

  return {
    lineItems: lineItems.data ?? [],
    skuOptions: skuOptions.data ?? [],
    isLoading: lineItems.isLoading || skuOptions.isLoading,
    createLineItem: createLineItem.mutateAsync,
    updateLineItem: updateLineItem.mutateAsync,
    removeLineItem: removeLineItem.mutateAsync,
    createSku: createSku.mutateAsync,
    isLineItemPending:
      createLineItem.isPending ||
      updateLineItem.isPending ||
      removeLineItem.isPending,
    isSkuPending: createSku.isPending,
    error:
      lineItems.error ??
      skuOptions.error ??
      createLineItem.error ??
      updateLineItem.error ??
      removeLineItem.error ??
      createSku.error ??
      null,
  }
}
