import type { ReactNode } from 'react'

interface KanbanCardShellProps {
  loading?: boolean
  isSelected?: boolean
  onClick?: () => void
  children: ReactNode
}

export function KanbanCardShell({
  loading,
  isSelected,
  onClick,
  children,
}: KanbanCardShellProps) {
  // Box styling only --- typography is the caller's concern (so the
  // card body can mix font weights/sizes between title and subtitle).
  // Height is content-driven: the column's wrapper measures each card
  // and adds the gap below structurally, so the tile's border always
  // surrounds its own contents regardless of font scaling at zoom.
  const base = 'rounded-md border px-3 py-2'
  const selected = isSelected
    ? 'border-blue-400 ring-2 ring-blue-400/50 bg-zinc-800'
    : 'border-zinc-700 bg-zinc-800'
  const loadingTone = loading ? 'animate-loading-card' : ''

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${selected} ${loadingTone} block w-full text-left transition-colors hover:border-zinc-500`}
      >
        {children}
      </button>
    )
  }

  return (
    <div
      aria-label={loading ? 'Loading order' : undefined}
      className={`${base} ${selected} ${loadingTone}`}
    >
      {children}
    </div>
  )
}
