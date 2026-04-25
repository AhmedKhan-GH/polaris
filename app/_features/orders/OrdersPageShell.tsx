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
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6"
    >
      {loading && <span className="sr-only">Loading orders</span>}
      {header}
      {children}
    </main>
  )
}
