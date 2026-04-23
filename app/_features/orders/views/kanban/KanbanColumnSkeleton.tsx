import { KanbanColumnShell } from './KanbanColumnShell'

export function KanbanColumnSkeleton({ name }: { name: string }) {
  return <KanbanColumnShell loading name={name} count="—" />
}
