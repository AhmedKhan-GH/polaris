const COLUMNS = ['Drafting', 'Reviewing', 'Invoicing', 'Archiving'] as const

export function OrderBoardSkeleton() {
  return (
    <main
      aria-busy="true"
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6"
    >
      <span className="sr-only">Loading orders</span>
      <header className="shrink-0 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-50">Orders</h1>
        <div
          aria-hidden
          className="h-8 w-[86px] rounded-md bg-zinc-700 animate-loading-card"
        />
      </header>

      <div className="flex-1 min-h-0 flex overflow-x-auto scrollbar-thin pb-2">
        <div className="flex gap-4 pr-4">
          {COLUMNS.map((column) => (
            <section
              key={column}
              aria-hidden
              className="flex w-64 shrink-0 min-h-0 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 animate-loading-card"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {column}
                </h2>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                  —
                </span>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
