import type { ReactNode } from 'react'

interface KanbanCardShellProps {
  loading?: boolean
  children: ReactNode
}

export function KanbanCardShell({ loading, children }: KanbanCardShellProps) {
  // Box styling only --- typography is the caller's concern (so the
  // card body can mix font weights/sizes between title and subtitle).
  const className = loading
    ? 'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 animate-loading-card'
    : 'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2'

  return (
    <div
      role="listitem"
      aria-label={loading ? 'Loading order' : undefined}
      className={className}
    >
      {children}
    </div>
  )
}
