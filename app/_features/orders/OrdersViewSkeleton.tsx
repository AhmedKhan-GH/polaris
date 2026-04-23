import { OrdersShell } from './OrdersShell'
import { KanbanBoardSkeleton } from './views/kanban/KanbanBoardSkeleton'

export function OrdersViewSkeleton() {
  return (
    <OrdersShell
      loading
      headerAction={
        <div
          aria-hidden
          className="h-8 w-[86px] rounded-md bg-zinc-700 animate-loading-card"
        />
      }
    >
      <KanbanBoardSkeleton />
    </OrdersShell>
  )
}
