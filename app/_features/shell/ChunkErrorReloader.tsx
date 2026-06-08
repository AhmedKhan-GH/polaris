'use client'

import { useEffect } from 'react'

// A stale-chunk recovery layer. When the deployed bundles change under an open
// tab (a prod deploy, or a dev-server restart), lazily-loaded chunks 404 with a
// ChunkLoadError. We catch it and reload once onto the current build.
const CHUNK_RE = /ChunkLoadError|Loading chunk [\w/-]+ failed|Failed to load chunk/i
// Timestamp of the last auto-reload — guards against reload loops if the fresh
// build is itself broken (a real error within the window is left to surface).
const FLAG = 'chunk-reload-at'
const COOLDOWN_MS = 10_000

export function ChunkErrorReloader() {
  useEffect(() => {
    const maybeReload = (message: string) => {
      if (!CHUNK_RE.test(message)) return
      const last = Number(sessionStorage.getItem(FLAG) ?? '0')
      if (Date.now() - last < COOLDOWN_MS) return
      sessionStorage.setItem(FLAG, String(Date.now()))
      window.location.reload()
    }

    const onError = (e: ErrorEvent) =>
      maybeReload(e.message || String(e.error ?? ''))
    const onRejection = (e: PromiseRejectionEvent) =>
      maybeReload(String(e.reason?.message ?? e.reason ?? ''))

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
