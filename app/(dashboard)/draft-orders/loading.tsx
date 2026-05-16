import { OrdersHeaderShell } from '../../_features/orders/header/OrdersHeaderShell'
import { OrdersPageShell } from '../../_features/orders/OrdersPageShell'
import { KanbanBoardShell } from '../../_features/orders/views/kanban/KanbanBoardShell'
import { KanbanColumnShell } from '../../_features/orders/views/kanban/KanbanColumnShell'

export default function DraftOrdersLoading() {
  return (
    <OrdersPageShell loading header={<OrdersHeaderShell loading />}>
      <KanbanBoardShell
        columns={[
          <KanbanColumnShell key="drafted" loading name="Drafted" status="drafted" count="—" />,
        ]}
      />
    </OrdersPageShell>
  )
}
