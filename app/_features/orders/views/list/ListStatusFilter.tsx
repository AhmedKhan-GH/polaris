'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ACTIVE_ORDER_STATUSES, type OrderStatus } from '@/lib/domain/order'
import type { OrderStatusCounts } from '@/lib/db/orderRepository'
import { StatusBadge } from '../../shared/StatusBadge'
import {
  ORDER_COUNT_FORMATTER,
  STATUS_FILTER_GROUPS,
} from './constants'

// Multi-select status filter rendered as a dropdown menu. The trigger
// shows a count badge when at least one status is selected so the
// active-filter state is visible without opening the menu.
export function ListStatusFilter({
  selected,
  onChange,
  counts,
  countsPending,
}: {
  selected: Set<OrderStatus>
  onChange: (next: Set<OrderStatus>) => void
  counts: OrderStatusCounts | undefined
  countsPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const someSelected = selected.size > 0

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

  function toggle(status: OrderStatus) {
    const next = new Set(selected)
    if (next.has(status)) {
      next.delete(status)
    } else {
      next.add(status)
    }
    onChange(next)
  }

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
        {someSelected && (
          <span className="rounded-full bg-blue-500/20 px-1.5 text-[10px] font-medium leading-4 text-blue-300">
            {selected.size}
          </span>
        )}
        {open ? (
          <ChevronUp aria-hidden className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronDown aria-hidden className="h-4 w-4 text-zinc-500" />
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-lg"
        >
          <div className="flex flex-col gap-1">
            {STATUS_FILTER_GROUPS.map((group, groupIndex) => (
              <Fragment key={groupIndex}>
                {groupIndex > 0 && (
                  <div
                    role="separator"
                    className="my-1 border-t border-zinc-800"
                  />
                )}
                {group.map((status) => {
                  const active = selected.has(status)
                  return (
                    <label
                      key={status}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 select-none hover:bg-zinc-800"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggle(status)}
                        className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 accent-blue-500"
                      />
                      <StatusBadge status={status} />
                      <span
                        aria-live="polite"
                        aria-label={`${status} count`}
                        className="ml-auto font-mono text-xs tabular-nums text-zinc-500"
                      >
                        {countsPending
                          ? '...'
                          : ORDER_COUNT_FORMATTER.format(counts?.[status] ?? 0)}
                      </span>
                    </label>
                  )
                })}
              </Fragment>
            ))}
          </div>
          <div className="my-1 border-t border-zinc-800" />
          <button
            type="button"
            onClick={() => onChange(new Set(ACTIVE_ORDER_STATUSES))}
            className="w-full rounded px-2 py-1 text-left text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  )
}
