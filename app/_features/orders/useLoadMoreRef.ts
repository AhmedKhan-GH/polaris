'use client'

import { useEffect, useState } from 'react'

// Returns a ref callback that watches an element with IntersectionObserver
// and calls onLoadMore when it scrolls into view. The 200px rootMargin fires
// the fetch slightly before the sentinel reaches the bottom edge so the
// next page is usually ready by the time the user gets there.
export function useLoadMoreRef({
  enabled,
  onLoadMore,
}: {
  enabled: boolean
  onLoadMore: () => void
}): (node: HTMLElement | null) => void {
  const [el, setEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!el || !enabled) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [el, enabled, onLoadMore])

  return setEl
}
