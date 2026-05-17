'use client'

import { memo, useCallback, useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { formatCreatedAt, type Order } from '@/lib/domain/order'
import { usePreferences } from '../../preferences/PreferencesProvider'
import { OrderCard } from './OrderCard'

const ESTIMATE_HEIGHT = 60

export function OrderList({
  orders,
  selectedId,
  onSelect,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  expectedTotal,
}: {
  orders: Order[]
  selectedId: string | null
  onSelect: (id: string) => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage?: () => void
  expectedTotal?: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const totalSlots = Math.max(orders.length, expectedTotal ?? 0)

  const virtualizer = useVirtualizer({
    count: totalSlots,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATE_HEIGHT,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 20,
  })

  useEffect(() => {
    if (!selectedId) return
    const index = orders.findIndex((o) => o.id === selectedId)
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'center' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measuredH = virtualizer.getVirtualItems()[0]?.size ?? ESTIMATE_HEIGHT
    const onScroll = () => {
      if (orders.length === 0) return
      if (!hasNextPage || isFetchingNextPage) return
      const loadedBottomPx = orders.length * measuredH
      const distanceFromLoadedBottom =
        loadedBottomPx - el.scrollTop - el.clientHeight
      if (distanceFromLoadedBottom < measuredH * 3) {
        fetchNextPage?.()
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [orders.length, hasNextPage, isFetchingNextPage, fetchNextPage, virtualizer])

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const el = scrollRef.current
    if (!el || orders.length === 0) return
    const measuredH = virtualizer.getVirtualItems()[0]?.size ?? ESTIMATE_HEIGHT
    const loadedBottomPx = orders.length * measuredH
    const distanceFromLoadedBottom =
      loadedBottomPx - el.scrollTop - el.clientHeight
    if (distanceFromLoadedBottom < measuredH * 3) {
      fetchNextPage?.()
    }
  }, [orders.length, hasNextPage, isFetchingNextPage, fetchNextPage, virtualizer])

  const items = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  if (orders.length === 0 && !isFetchingNextPage) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        No orders
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
    >
      <div className="relative w-full" style={{ height: totalSize }}>
        {items.map((vi) => {
          const order = orders[vi.index]
          if (!order) {
            return (
              <div
                key={`shell-${vi.index}`}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                className="absolute left-0 right-0 pb-2"
                style={{
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <OrderCard loading>
                  <div className="flex flex-col gap-[2px] leading-tight">
                    <span className="block h-4 w-20 rounded bg-zinc-700" />
                    <span className="block h-3 w-36 rounded bg-zinc-700/70" />
                  </div>
                </OrderCard>
              </div>
            )
          }
          return (
            <div
              key={order.id}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              className="absolute left-0 right-0 pb-2"
              style={{
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <OrderListCard
                order={order}
                isSelected={order.id === selectedId}
                onSelect={onSelect}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const OrderListCard = memo(function OrderListCard({
  order,
  isSelected,
  onSelect,
}: {
  order: Order
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const { timezone, hour12 } = usePreferences()
  const handleClick = useCallback(
    () => onSelect(order.id),
    [onSelect, order.id],
  )
  return (
    <OrderCard isSelected={isSelected} onClick={handleClick}>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-mono text-sm font-medium text-zinc-50">
          #{order.orderNumber}
        </span>
        <span className="truncate text-[11px] text-zinc-400">
          {formatCreatedAt(order.createdAt, timezone, hour12)}
        </span>
      </div>
    </OrderCard>
  )
})
