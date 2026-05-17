'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { TERMINAL_ORDER_STATUSES, type OrderStatus } from '@/lib/domain/order'
import type { UserRole } from '@/lib/profile'
import type { OrderStatusCounts } from '@/lib/db/orderRepository'
import { useOrdersByStatus, type DateFilters } from '../data/useOrdersByStatus'
import { findInCaches } from '../data/cacheHelpers'
import { usePreferences } from '../../preferences/PreferencesProvider'
import { OrderList } from '../shared/OrderList'
import { StatusPill } from '../shared/StatusPill'
import { KanbanColumnShell } from './kanban/KanbanColumnShell'
import { OrderDetailPanel } from './OrderDetailPanel'
import {
  boundToTimestamp,
  ListDateFilter,
  type ListDateFilterValues,
} from './list/ListDateFilter'

const EMPTY_DATE_RANGE: ListDateFilterValues = {
  dateFrom: '',
  timeFrom: '',
  dateTo: '',
  timeTo: '',
}

export interface StatusOrdersViewProps {
  statuses: readonly OrderStatus[]
  statusCounts: OrderStatusCounts | undefined
  role?: UserRole
}

export function StatusOrdersView({ statuses, statusCounts, role = 'owner' }: StatusOrdersViewProps) {
  const [activeStatus, setActiveStatus] = useState<OrderStatus>(statuses[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<ListDateFilterValues>(EMPTY_DATE_RANGE)
  const { timezone } = usePreferences()

  const dateFilters = useMemo(() => {
    const createdFrom = boundToTimestamp(dateRange.dateFrom, dateRange.timeFrom, 'start', timezone)
    const createdTo = boundToTimestamp(dateRange.dateTo, dateRange.timeTo, 'end', timezone)
    const f: { createdFrom?: number; createdTo?: number } = {}
    if (createdFrom !== null) f.createdFrom = createdFrom
    if (createdTo !== null) f.createdTo = createdTo
    return Object.keys(f).length > 0 ? f : undefined
  }, [dateRange, timezone])

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3">
        <DetailStatusDropdown
          statuses={statuses}
          statusCounts={statusCounts}
          active={activeStatus}
          onChange={setActiveStatus}
        />
        <ListDateFilter value={dateRange} onChange={setDateRange} />
      </div>

      <StatusPanel
        key={activeStatus}
        status={activeStatus}
        selectedId={selectedId}
        onSelect={handleSelect}
        role={role}
        dateFilters={dateFilters}
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
  dateFilters,
}: {
  status: OrderStatus
  selectedId: string | null
  onSelect: (id: string) => void
  role: UserRole
  dateFilters?: DateFilters
}) {
  const { cards, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrdersByStatus(status, dateFilters)
  const queryClient = useQueryClient()

  const selectedOrder = selectedId
    ? findInCaches(queryClient, selectedId)
    : null

  return (
    <div className="flex min-h-0 flex-1">
      {/* Order list */}
      <div className="flex w-72 shrink-0 flex-col">
        <KanbanColumnShell name={status} status={status} count={cards.length}>
          <OrderList
            orders={cards}
            selectedId={selectedId}
            onSelect={onSelect}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </KanbanColumnShell>
      </div>

      {/* Detail panel */}
      <div className="flex flex-1 flex-col">
        {selectedOrder ? (
          <OrderDetailPanel order={selectedOrder} role={role} />
        ) : (
          <DetailPanelSkeleton />
        )}
      </div>
    </div>
  )
}

function DetailPanelSkeleton() {
  return (
    <div className="flex flex-1 flex-col animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
        <span className="h-5 w-20 rounded bg-zinc-700/60" />
        <span className="h-6 w-16 rounded-full bg-zinc-700/40" />
      </div>

      {/* Metadata */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
          <span className="h-4 w-14 rounded bg-zinc-700/40" />
          <span className="h-4 w-40 rounded bg-zinc-700/60" />
          <span className="h-4 w-20 rounded bg-zinc-700/40" />
          <span className="h-4 w-36 rounded bg-zinc-700/60" />
          <span className="h-4 w-24 rounded bg-zinc-700/40" />
          <span className="h-4 w-40 rounded bg-zinc-700/60" />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 px-6 py-4">
        <div className="rounded-lg border border-dashed border-zinc-800 py-12 flex items-center justify-center text-sm text-zinc-600">
          Select an order
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-zinc-800 px-5 py-4">
        <span className="h-9 flex-1 rounded bg-zinc-700/30" />
        <span className="h-9 flex-1 rounded bg-zinc-700/30" />
        <span className="h-9 flex-1 rounded bg-zinc-700/30" />
      </div>
    </div>
  )
}
