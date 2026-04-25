'use client'

import { memo } from 'react'
import type { Order } from '@/lib/domain/order'
import { KanbanCardShell } from './KanbanCardShell'

export const KanbanCard = memo(function KanbanCard({
  order,
}: {
  order: Order
}) {
  return <KanbanCardShell>{order.orderNumber}</KanbanCardShell>
})
