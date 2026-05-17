export default function OrdersLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-zinc-800 px-4 py-2.5">
        <div className="h-5 w-20 animate-pulse rounded bg-zinc-800" />
        <div className="h-5 w-20 animate-pulse rounded bg-zinc-800" />
        <div className="h-5 w-20 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 border-r border-zinc-800 animate-pulse" />
        <div className="flex-1" />
      </div>
    </div>
  )
}
