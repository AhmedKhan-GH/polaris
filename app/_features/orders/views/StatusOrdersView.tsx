'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatCreatedAt, type Order, type OrderStatus } from '@/lib/domain/order'
import { usePreferences } from '../../preferences/PreferencesProvider'
import { useOrdersByStatus } from '../data/useOrdersByStatus'
import { useOrders } from '../data/useOrders'
import { findInCaches } from '../data/cacheHelpers'
import { StatusBadge } from '../shared/StatusBadge'
import { OrderDetailPanel } from './OrderDetailPanel'

export interface StatusOrdersViewProps {
  statuses: readonly OrderStatus[]
  canCreate?: boolean
}

export function StatusOrdersView({ statuses }: StatusOrdersViewProps) {
  const [activeStatus, setActiveStatus] = useState<OrderStatus>(statuses[0])
  const { statusCounts } = useOrders()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 px-4">
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveStatus(status)}
            className={`relative px-3 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeStatus === status
                ? 'text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {status}
            {statusCounts && (
              <span className={`ml-1.5 text-xs ${activeStatus === status ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {statusCounts[status] ?? 0}
              </span>
            )}
            {activeStatus === status && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-100 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Per-status content */}
      <StatusPanel key={activeStatus} status={activeStatus} />
    </div>
  )
}

function StatusPanel({ status }: { status: OrderStatus }) {
  const { cards, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrdersByStatus(status)
  const queryClient = useQueryClient()
  const { timezone, hour12 } = usePreferences()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedOrder = selectedId
    ? findInCaches(queryClient, selectedId)
    : null

  const handleSelect = useCallback((id: string) => setSelectedId(id), [])

  return (
    <div className="flex min-h-0 flex-1">
      {/* Order list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-800">
        <div className="flex-1 overflow-y-auto">
          {cards.map((order) => (
            <OrderListItem
              key={order.id}
              order={order}
              isSelected={selectedId === order.id}
              onSelect={handleSelect}
              timezone={timezone}
              hour12={hour12}
            />
          ))}

          {hasNextPage && (
            <button
              type="button"
              disabled={isFetchingNextPage}
              onClick={fetchNextPage}
              className="w-full px-4 py-3 text-center text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-60"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          )}

          {cards.length === 0 && !isFetchingNextPage && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No orders
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex flex-1 flex-col">
        {selectedOrder ? (
          <OrderDetailPanel order={selectedOrder} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Select an order to view details
          </div>
        )}
      </div>
    </div>
  )
}

function OrderListItem({
  order,
  isSelected,
  onSelect,
  timezone,
  hour12,
}: {
  order: Order
  isSelected: boolean
  onSelect: (id: string) => void
  timezone: string
  hour12: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(order.id)}
      className={`w-full border-b border-zinc-800/50 px-4 py-3 text-left transition-colors ${
        isSelected ? 'bg-zinc-800/80' : 'hover:bg-zinc-900'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-zinc-200">
          #{order.orderNumber}
        </span>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
        <span>{formatCreatedAt(order.createdAt, timezone, hour12)}</span>
        {order.createdByEmail && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="truncate">{order.createdByEmail}</span>
          </>
        )}
      </div>
    </button>
  )
}
