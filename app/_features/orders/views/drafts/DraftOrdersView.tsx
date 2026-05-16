'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatCreatedAt, type Order } from '@/lib/domain/order'
import { usePreferences } from '../../../preferences/PreferencesProvider'
import { useOrdersByStatus } from '../../data/useOrdersByStatus'
import { useOrders } from '../../data/useOrders'
import { findInCaches } from '../../data/cacheHelpers'
import { StatusBadge } from '../../shared/StatusBadge'
import { DraftDetailPanel } from './DraftDetailPanel'

export function DraftOrdersView() {
  const { cards, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrdersByStatus('drafted')
  const { isCreating, createOrder, statusCounts } = useOrders()
  const queryClient = useQueryClient()
  const { timezone, hour12 } = usePreferences()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedOrder = selectedId
    ? findInCaches(queryClient, selectedId)
    : null

  const handleSelect = useCallback((id: string) => setSelectedId(id), [])

  return (
    <div className="flex min-h-0 flex-1">
      {/* Order list panel */}
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-zinc-100">Drafts</h2>
            {statusCounts && (
              <span className="text-xs text-zinc-500">
                {statusCounts.drafted ?? 0}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={isCreating}
            onClick={createOrder}
            className="rounded bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
          >
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {cards.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => handleSelect(order.id)}
              className={`w-full border-b border-zinc-800/50 px-4 py-3 text-left transition-colors ${
                selectedId === order.id
                  ? 'bg-zinc-800/80'
                  : 'hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-zinc-200">
                  #{order.orderNumber}
                </span>
                <StatusBadge status={order.status} />
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {formatCreatedAt(order.createdAt, timezone, hour12)}
              </div>
            </button>
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
              No draft orders
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex flex-1 flex-col">
        {selectedOrder ? (
          <DraftDetailPanel order={selectedOrder} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Select an order to view details
          </div>
        )}
      </div>
    </div>
  )
}
