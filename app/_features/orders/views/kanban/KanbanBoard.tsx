'use client'

import type { OrderWithPending } from '../../useOrders'
import { KanbanBoardShell } from './KanbanBoardShell'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard({ orders }: { orders: OrderWithPending[] }) {
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
