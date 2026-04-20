// Card-shaped placeholder shown when no real card exists at this position
// yet. Used by OrderBoardSkeleton during the initial board fetch, and as
// the visual language reference for OrderCard's pending branch (which
// inlines an equivalent pulsing span so the <li> stays the same element
// across the pending -> resolved transition).

export function OrderCardSkeleton() {
  return (
    <li
      aria-hidden
      className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2"
    >
      <span className="inline-block h-4 w-14 rounded bg-zinc-700 animate-pulse align-middle" />
    </li>
  )
}
