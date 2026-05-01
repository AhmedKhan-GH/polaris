import type { ReactNode } from 'react'
import type { OrderStatus } from '@/lib/domain/order'
import { STATUS_BADGE_TONES } from '../../shared/StatusBadge'

interface KanbanColumnShellProps {
  name: string
  status: OrderStatus
  count: ReactNode
  loading?: boolean
  // Optional inline element rendered in the header bar between the
  // column title and the count badge. Used for the "↑ N new" pill on
  // the Drafting column.
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
  const titleClass = `min-w-0 truncate rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_BADGE_TONES[status]}`
  const sectionClass = loading
    ? 'flex w-full min-w-64 min-h-0 flex-1 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 animate-loading-card'
    : 'flex w-full min-w-64 min-h-0 flex-1 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3'
  const countClass = loading
    ? 'font-mono text-xs tabular-nums text-zinc-600'
    : 'font-mono text-xs tabular-nums text-zinc-500'

  return (
    <section aria-hidden={loading || undefined} className={sectionClass}>
      {/* Single-row header strip: title + count cluster pinned to the
          left, "↑ N new" pill pinned to the right via justify-between.
          The pill is rendered directly as a flex child (no wrapper
          div) so items-center on the row vertically centers it on the
          same baseline as the count badge --- a wrapper around it
          collapses to its content's natural baseline and made the
          pill appear offset from the count. */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className={titleClass}>
            {name}
          </h2>
          <span className={countClass}>{count}</span>
        </div>
        {headerAlert}
      </div>
      {children}
    </section>
  )
}
