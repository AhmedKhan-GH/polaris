import type { ReactNode } from 'react'

interface OrdersHeaderShellProps {
  loading?: boolean
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
}

function LoadingPrimaryAction() {
  return (
    <div
      aria-hidden
      className="h-8 w-[86px] rounded-md bg-zinc-700 animate-loading-card"
    />
  )
}

function LoadingSecondaryAction() {
  return (
    <div
      aria-hidden
      className="inline-flex overflow-hidden rounded-md border border-zinc-700 bg-zinc-900"
    >
      <div className="h-8 w-[76px] bg-zinc-700 animate-loading-card" />
      <div className="h-8 w-[104px] border-l border-zinc-700 bg-zinc-800 animate-loading-card" />
    </div>
  )
}

export function OrdersHeaderShell({
  loading,
  primaryAction,
  secondaryAction,
}: OrdersHeaderShellProps) {
  return (
    <header className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold text-zinc-50">Orders</h1>
        {loading ? <LoadingPrimaryAction /> : primaryAction}
      </div>
      <div className="w-full sm:w-auto">
        {loading ? <LoadingSecondaryAction /> : secondaryAction}
      </div>
    </header>
  )
}
