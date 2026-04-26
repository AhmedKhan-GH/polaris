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
    <header className="shrink-0 flex items-center justify-between gap-3">
      <div className="flex shrink-0 items-center gap-4">
        <h1 className="whitespace-nowrap text-xl font-semibold text-zinc-50">
          Orders
        </h1>
        {loading ? <LoadingPrimaryAction /> : primaryAction}
      </div>
      <div className="shrink-0">
        {loading ? <LoadingSecondaryAction /> : secondaryAction}
      </div>
    </header>
  )
}
