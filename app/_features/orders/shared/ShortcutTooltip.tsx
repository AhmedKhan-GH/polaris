import type { ReactNode } from 'react'

export function ShortcutTooltip({
  label,
  shortcut,
  children,
  className = '',
}: {
  label: string
  shortcut?: string
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`group/shortcut relative min-w-0 ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200 shadow-xl group-hover/shortcut:block group-focus-within/shortcut:block"
      >
        <span>{label}</span>
        {shortcut && (
          <kbd className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-1 font-mono text-[10px] text-zinc-400">
            {shortcut}
          </kbd>
        )}
      </span>
    </span>
  )
}
