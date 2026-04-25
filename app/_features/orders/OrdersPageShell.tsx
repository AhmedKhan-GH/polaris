import type { ReactNode } from 'react'

interface OrdersPageShellProps {
  loading?: boolean
  headerAction: ReactNode
  children: ReactNode
}

export function OrdersPageShell({ loading, headerAction, children }: OrdersPageShellProps) {
  return (
    <main
      aria-busy={loading ? 'true' : undefined}
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6"
    >
      {loading && <span className="sr-only">Loading orders</span>}
      <header className="shrink-0 flex items-center gap-4">
        <h1 className="text-xl font-semibold text-zinc-50">Orders</h1>
        {headerAction}
      </header>
      {children}
    </main>
  )
}
