'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatCreatedAt, type Order, type OrderStatus } from '@/lib/domain/order'
import type { OrderStatusCounts } from '@/lib/db/orderRepository'
import { usePreferences } from '../../preferences/PreferencesProvider'
import { useOrdersByStatus } from '../data/useOrdersByStatus'
import { findInCaches } from '../data/cacheHelpers'
import { OrderCard } from '../shared/OrderCard'
import { StatusPill } from '../shared/StatusPill'
import { OrderDetailPanel } from './OrderDetailPanel'

export interface StatusOrdersViewProps {
  statuses: readonly OrderStatus[]
  statusCounts: OrderStatusCounts | undefined
  selectedId: string | null
  onSelect: (id: string) => void
}

export function StatusOrdersView({ statuses, statusCounts, selectedId, onSelect }: StatusOrdersViewProps) {
  const [activeStatus, setActiveStatus] = useState<OrderStatus>(statuses[0])
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!selectedId) return
    const order = findInCaches(queryClient, selectedId)
    if (order && statuses.includes(order.status)) {
      setActiveStatus(order.status)
    }
  }, [selectedId, queryClient, statuses])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Status tabs */}
      <div className="flex items-center gap-2 px-4">
        {statuses.map((status) => (
          <StatusPill
            key={status}
            status={status}
            count={statusCounts?.[status] ?? 0}
            active={activeStatus === status}
            onClick={() => setActiveStatus(status)}
          />
        ))}
      </div>

      {/* Per-status content */}
      <StatusPanel
        key={activeStatus}
        status={activeStatus}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}

function StatusPanel({
  status,
  selectedId,
  onSelect,
}: {
  status: OrderStatus
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { cards, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrdersByStatus(status)
  const queryClient = useQueryClient()
  const { timezone, hour12 } = usePreferences()

  const selectedOrder = selectedId
    ? findInCaches(queryClient, selectedId)
    : null

  const handleSelect = useCallback((id: string) => onSelect(id), [onSelect])

  return (
    <div className="flex min-h-0 flex-1">
      {/* Order list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-800">
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {cards.map((order) => (
            <OrderCard
              key={order.id}
              isSelected={selectedId === order.id}
              onClick={() => handleSelect(order.id)}
            >
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-mono text-sm font-medium text-zinc-50">
                  #{order.orderNumber}
                </span>
                <span className="truncate text-[11px] text-zinc-400">
                  {formatCreatedAt(order.createdAt, timezone, hour12)}
                </span>
              </div>
            </OrderCard>
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
