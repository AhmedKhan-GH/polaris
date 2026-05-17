export default function OrdersLoading() {
  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <span className="sr-only">Loading orders</span>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
        {/* Header skeleton */}
        <header className="shrink-0 flex items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-4">
            <h1 className="whitespace-nowrap text-xl font-semibold text-zinc-50">
              Orders
            </h1>
            <div
              aria-hidden
              className="h-8 w-[86px] rounded-md bg-zinc-700 animate-pulse"
            />
          </div>
          <div className="shrink-0">
            <div
              aria-hidden
              className="inline-flex overflow-hidden rounded-md border border-zinc-700 bg-zinc-900"
            >
              <div className="h-8 w-[60px] bg-zinc-700 animate-pulse" />
              <div className="h-8 w-[60px] border-l border-zinc-700 bg-zinc-800 animate-pulse" />
              <div className="h-8 w-[60px] border-l border-zinc-700 bg-zinc-800 animate-pulse" />
            </div>
          </div>
        </header>
        {/* Content skeleton */}
        <div className="flex min-h-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 animate-pulse" />
      </div>
    </main>
  )
}
