'use client'

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'

// Keeps the user's visual position stable when the list grows at the
// top. Driven by `totalCount` so it works whether new rows landed in
// cache or only bumped a count, and regardless of how the cache was
// shaped underneath.
//
// When totalCount grows by N, the global row at the user's current
// scrollTop has shifted down by N rows. If the user is scrolled away
// from the top, we add N × itemHeight to scrollTop to compensate ---
// the visible window stays put, and we surface the delta as an unseen
// counter the view can render as a "↑ N new" indicator. At
// scrollTop === 0, prepends push naturally into view and don't count
// as unseen.
export function useScrollAnchor(
  scrollRef: RefObject<HTMLElement | null>,
  totalCount: number,
  itemHeight: number,
): { unseenCount: number; reset: () => void } {
  const previousCountRef = useRef<number | null>(null)
  const [unseenCount, setUnseenCount] = useState(0)

  useLayoutEffect(() => {
    const previous = previousCountRef.current
    previousCountRef.current = totalCount

    if (previous === null) return
    const delta = totalCount - previous
    if (delta <= 0) return

    const el = scrollRef.current
    if (!el || el.scrollTop === 0) return

    el.scrollTop += delta * itemHeight
    setUnseenCount((n) => n + delta)
  }, [totalCount, itemHeight, scrollRef])

  const reset = useCallback(() => {
    setUnseenCount(0)
  }, [])

  return { unseenCount, reset }
}
