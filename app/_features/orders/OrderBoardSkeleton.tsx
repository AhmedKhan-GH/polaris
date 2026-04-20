import { OrderColumnSkeleton } from './OrderColumnSkeleton'

export function OrderBoardSkeleton() {
  return (
    <main
      aria-busy="true"
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6"
    >
      <span className="sr-only">Loading orders</span>
      <header className="shrink-0 flex items-center gap-4">
        <h1 className="text-xl font-semibold text-zinc-50">Orders</h1>
        <div
          aria-hidden
          className="h-8 w-[86px] rounded-md bg-zinc-700 animate-loading-card"
        />
      </header>

      <div className="flex-1 min-h-0 flex overflow-x-auto scrollbar-thin pb-2">
        <div className="flex flex-1 min-h-0 pr-4 items-stretch">
          <div className="flex min-h-0 flex-col gap-2">
            <span className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
              Submitted →
            </span>
            <OrderColumnSkeleton name="Drafting" />
          </div>
          <div
            aria-hidden
            className="mx-4 w-0.5 shrink-0 self-stretch rounded-full bg-zinc-700"
          />
          <div className="flex min-h-0 flex-col gap-2">
            <span className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
              Invoiced →
            </span>
            <OrderColumnSkeleton name="Reviewing" />
          </div>
          <div
            aria-hidden
            className="mx-4 w-0.5 shrink-0 self-stretch rounded-full bg-zinc-700"
          />
          <div className="flex min-h-0 flex-col gap-2">
            <span className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
              Closed →
            </span>
            <OrderColumnSkeleton name="Fulfilling" />
          </div>
          <div
            aria-hidden
            className="mx-4 w-0.5 shrink-0 self-stretch rounded-full bg-zinc-700"
          />
          <div className="flex min-h-0 flex-col gap-2">
            <span aria-hidden className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-transparent whitespace-nowrap select-none">
              &nbsp;
            </span>
            <OrderColumnSkeleton name="Archiving" />
          </div>
        </div>
      </div>
    </main>
  )
}
