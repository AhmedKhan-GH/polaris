'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { formatCreatedAt, TERMINAL_ORDER_STATUSES, type Order, type OrderStatus } from '@/lib/domain/order'
import type { UserRole } from '@/lib/profile'
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
  role?: UserRole
}

export function StatusOrdersView({ statuses, statusCounts, selectedId, onSelect, role = 'owner' }: StatusOrdersViewProps) {
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <DetailStatusDropdown
        statuses={statuses}
        statusCounts={statusCounts}
        active={activeStatus}
        onChange={setActiveStatus}
      />

      {/* Per-status content */}
      <StatusPanel
        key={activeStatus}
        status={activeStatus}
        selectedId={selectedId}
        onSelect={onSelect}
        role={role}
      />
    </div>
  )
}

function DetailStatusDropdown({
  statuses,
  statusCounts,
  active,
  onChange,
}: {
  statuses: readonly OrderStatus[]
  statusCounts: OrderStatusCounts | undefined
  active: OrderStatus
  onChange: (status: OrderStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative inline-block self-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
      >
        <span>Status</span>
        {open ? (
          <ChevronUpIcon aria-hidden className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronDownIcon aria-hidden className="h-4 w-4 text-zinc-500" />
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-lg"
        >
          <div className="flex flex-col gap-1">
            {statuses.map((status) => (
              <label
                key={status}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 select-none hover:bg-zinc-800"
              >
                <input
                  type="radio"
                  name="detail-status"
                  checked={active === status}
                  onChange={() => {
                    onChange(status)
                    setOpen(false)
                  }}
                  className="h-4 w-4 cursor-pointer border-zinc-700 bg-zinc-900 accent-blue-500"
                />
                <StatusPill status={status} />
                <span className="ml-auto font-mono text-xs tabular-nums text-zinc-500">
                  {statusCounts?.[status] ?? 0}
                </span>
              </label>
            ))}
            <div role="separator" className="my-1 border-t border-zinc-800" />
            {TERMINAL_ORDER_STATUSES.map((status) => (
              <label
                key={status}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 select-none hover:bg-zinc-800"
              >
                <input
                  type="radio"
                  name="detail-status"
                  checked={active === status}
                  onChange={() => {
                    onChange(status)
                    setOpen(false)
                  }}
                  className="h-4 w-4 cursor-pointer border-zinc-700 bg-zinc-900 accent-blue-500"
                />
                <StatusPill status={status} />
                <span className="ml-auto font-mono text-xs tabular-nums text-zinc-500">
                  {statusCounts?.[status] ?? 0}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPanel({
  status,
  selectedId,
  onSelect,
  role,
}: {
  status: OrderStatus
  selectedId: string | null
  onSelect: (id: string) => void
  role: UserRole
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
          <OrderDetailPanel order={selectedOrder} role={role} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Select an order to view details
          </div>
        )}
      </div>
    </div>
  )
}
