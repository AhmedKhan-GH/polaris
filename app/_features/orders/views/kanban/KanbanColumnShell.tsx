import type { ReactNode } from 'react'

interface KanbanColumnShellProps {
  name: string
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
  count,
  loading,
  headerAlert,
  children,
}: KanbanColumnShellProps) {
  const sectionClass = loading
    ? 'flex w-full min-w-64 min-h-0 flex-1 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 animate-loading-card'
    : 'flex w-full min-w-64 min-h-0 flex-1 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3'
  const badgeClass = loading
    ? 'rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-500'
    : 'rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300'

  return (
    <section aria-hidden={loading || undefined} className={sectionClass}>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {name}
          </h2>
          {headerAlert}
        </div>
        <span className={badgeClass}>{count}</span>
      </div>
      {children}
    </section>
  )
}
