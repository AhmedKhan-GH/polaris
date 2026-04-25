import { Suspense } from 'react'
import { findAllOrders } from '@/lib/db/orderRepository'
import { OrdersShell } from './_features/orders/OrdersShell'
import { OrdersView } from './_features/orders/OrdersView'
import { KanbanBoardShell } from './_features/orders/views/kanban/KanbanBoardShell'
import { KanbanColumnShell } from './_features/orders/views/kanban/KanbanColumnShell'

const FALLBACK = (
  <OrdersShell
    loading
    headerAction={
      <div
        aria-hidden
        className="h-8 w-[86px] rounded-md bg-zinc-700 animate-loading-card"
      />
    }
  >
    <KanbanBoardShell
      columns={[
        <KanbanColumnShell key="drafting" loading name="Drafting" count="—" />,
        <KanbanColumnShell key="reviewing" loading name="Reviewing" count="—" />,
        <KanbanColumnShell key="fulfilling" loading name="Fulfilling" count="—" />,
        <KanbanColumnShell key="archiving" loading name="Archiving" count="—" />,
      ]}
    />
  </OrdersShell>
)

export default function Home() {
  return (
    <Suspense fallback={FALLBACK}>
      <OrdersViewData />
    </Suspense>
  )
}

async function OrdersViewData() {
  const initial = await findAllOrders()
  return <OrdersView initial={initial} />
}
