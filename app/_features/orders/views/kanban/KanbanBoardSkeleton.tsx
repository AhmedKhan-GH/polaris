import { KanbanBoardShell } from './KanbanBoardShell'
import { KanbanColumnSkeleton } from './KanbanColumnSkeleton'

export function KanbanBoardSkeleton() {
  return (
    <KanbanBoardShell
      columns={[
        <KanbanColumnSkeleton key="drafting" name="Drafting" />,
        <KanbanColumnSkeleton key="reviewing" name="Reviewing" />,
        <KanbanColumnSkeleton key="fulfilling" name="Fulfilling" />,
        <KanbanColumnSkeleton key="archiving" name="Archiving" />,
      ]}
    />
  )
}
