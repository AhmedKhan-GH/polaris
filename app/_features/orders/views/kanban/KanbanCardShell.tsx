import type { ReactNode } from 'react'

interface KanbanCardShellProps {
  loading?: boolean
  children: ReactNode
}

export function KanbanCardShell({ loading, children }: KanbanCardShellProps) {
  const className = loading
    ? 'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm font-medium text-zinc-400 animate-loading-card'
    : 'rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm font-medium text-zinc-50'

  return (
    <li
      aria-label={loading ? 'Loading order' : undefined}
      className={className}
    >
      {children}
    </li>
  )
}
