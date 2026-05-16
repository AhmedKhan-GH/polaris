import { OrdersHeaderShell } from '../../_features/orders/header/OrdersHeaderShell'
import { OrdersPageShell } from '../../_features/orders/OrdersPageShell'
import { KanbanBoardShell } from '../../_features/orders/views/kanban/KanbanBoardShell'
import { KanbanColumnShell } from '../../_features/orders/views/kanban/KanbanColumnShell'

export default function OrdersLoading() {
  return (
    <OrdersPageShell loading header={<OrdersHeaderShell loading />}>
      <KanbanBoardShell
        columns={[
          <KanbanColumnShell key="drafted"   loading name="Drafted"   status="drafted"   count="—" />,
          <KanbanColumnShell key="submitted" loading name="Submitted" status="submitted" count="—" />,
          <KanbanColumnShell key="invoiced"  loading name="Invoiced"  status="invoiced"  count="—" />,
          <KanbanColumnShell key="closed"    loading name="Closed"    status="closed"    count="—" />,
        ]}
      />
    </OrdersPageShell>
  )
}
