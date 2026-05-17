import type { ReactNode } from 'react'
import type { OrderStatus } from '@/lib/domain/order'
import { StatusPill } from '../../shared/StatusPill'

interface KanbanColumnShellProps {
  name: string
  status: OrderStatus
  count: ReactNode
  loading?: boolean
  headerAlert?: ReactNode
  children?: ReactNode
}

export function KanbanColumnShell({
  name,
  status,
  count,
  loading,
  headerAlert,
  children,
}: KanbanColumnShellProps) {
  const sectionClass = loading
    ? 'flex w-full min-w-64 min-h-0 flex-1 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 animate-loading-card'
    : 'flex w-full min-w-64 min-h-0 flex-1 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3'

  return (
    <section aria-hidden={loading || undefined} className={sectionClass}>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <span className="font-mono text-xs tabular-nums text-zinc-500">{count}</span>
        </div>
        {headerAlert}
      </div>
      {children}
    </section>
  )
}
