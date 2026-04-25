'use client'

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'

// Anchors scroll position when the global ordering grows (a row was
// added at the top, either via realtime cache mutation when page 0 is
// loaded, or via an evicted-state insert that bumped the eviction
// offset). Driven entirely by `totalCount` --- not by inspecting
// cards, since under eviction cards[0] doesn't equal global row 0.
//
// When totalCount increases by N, the global row at the user's current
// scrollTop has shifted down by N rows. We compensate by adding
// N × itemHeight to scrollTop --- if the user is scrolled away from
// the top. At the top, we let prepends push naturally into view and
// don't count them as unseen.
export function useStableScrollOnPrepend(
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
