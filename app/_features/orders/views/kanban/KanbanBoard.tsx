'use client'

import type { Order } from '@/lib/domain/order'
import { KanbanBoardShell } from './KanbanBoardShell'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard({ orders }: { orders: Order[] }) {
  return (
    <KanbanBoardShell
      columns={[
        <KanbanColumn key="drafting" name="Drafting" cards={orders} />,
        <KanbanColumn key="reviewing" name="Reviewing" cards={[]} />,
        <KanbanColumn key="fulfilling" name="Fulfilling" cards={[]} />,
        <KanbanColumn key="archiving" name="Archiving" cards={[]} />,
      ]}
    />
  )
}
