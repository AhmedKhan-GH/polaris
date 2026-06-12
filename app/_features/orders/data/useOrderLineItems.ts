'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createOrderLineItemAction,
  createSkuAction,
  deleteOrderLineItemAction,
  findSkuOptionsAction,
  updateOrderLineItemAction,
} from './actions'
import { SKU_OPTIONS_QUERY_KEY } from './queryKeys'
import { useOrderLineItemRows } from './useOrderLineItemRows'

function optionalPrice(value: string): number | null {
  const normalized = value.trim()
  if (!normalized) return null
  return Number(normalized)
}

export function useOrderLineItems(orderId: string) {
  const queryClient = useQueryClient()

  const {
    lineItems,
    isLoading: lineItemsLoading,
    error: lineItemsError,
    refreshLineItems,
  } = useOrderLineItemRows(orderId)

  const skuOptions = useQuery({
    queryKey: SKU_OPTIONS_QUERY_KEY,
    queryFn: () => findSkuOptionsAction(),
  })

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
    lineItems,
    skuOptions: skuOptions.data ?? [],
    isLoading: lineItemsLoading || skuOptions.isLoading,
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
      lineItemsError ??
      skuOptions.error ??
      createLineItem.error ??
      updateLineItem.error ??
      removeLineItem.error ??
      createSku.error ??
      null,
  }
}
