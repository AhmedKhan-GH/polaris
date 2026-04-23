'use client'

import { memo } from 'react'
import type { OrderWithPending } from '../../useOrders'
import { KanbanCardShell } from './KanbanCardShell'
import { KanbanCardSkeleton } from './KanbanCardSkeleton'

export const KanbanCard = memo(function KanbanCard({
  order,
}: {
  order: OrderWithPending
}) {
  if (order.pending) return <KanbanCardSkeleton />
  return <KanbanCardShell>{order.orderNumber}</KanbanCardShell>
})
