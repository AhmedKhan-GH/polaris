import type { ReactNode } from 'react'

interface OrdersPageShellProps {
  loading?: boolean
  header: ReactNode
  children: ReactNode
}

export function OrdersPageShell({ loading, header, children }: OrdersPageShellProps) {
  return (
    <main
      aria-busy={loading ? 'true' : undefined}
      className="flex min-h-0 flex-1 flex-col p-6"
    >
      {loading && <span className="sr-only">Loading orders</span>}
      {/* Overflow lives on this inner wrapper so the page padding on
          <main> is honored as a hard right/left margin. Without the
          split, overflow-hidden + padding clips at the padding edge,
          which lets a too-wide header bleed visually into the page
          margin before being cut off. */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
        {header}
        {children}
      </div>
    </main>
  )
}
