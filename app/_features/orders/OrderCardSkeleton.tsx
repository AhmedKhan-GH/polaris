// Card-shaped placeholder shown when no real card exists at this position
// yet. Used by OrderBoardSkeleton during the initial board fetch, and by
// OrderCard's pending branch for optimistic cards.
//
// Two layered animations:
//   - animate-loading-card fades the whole card between opacity 1 and
//     0.25 so the card visibly breathes against the zinc-900 column
//     background.
//   - animate-loading-dot on each period staggers a cycle through the
//     three dots, giving "Loading..." an active, unambiguous motion.
//
// Both are defined in app/globals.css; the defaults from Tailwind's
// animate-pulse are too subtle on this dark palette.

export function OrderCardSkeleton() {
  return (
    <li
      aria-label="Loading order"
      className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm font-medium text-zinc-400 animate-loading-card"
    >
      Loading
      <span className="animate-loading-dot">.</span>
      <span className="animate-loading-dot" style={{ animationDelay: '0.2s' }}>
        .
      </span>
      <span className="animate-loading-dot" style={{ animationDelay: '0.4s' }}>
        .
      </span>
    </li>
  )
}
