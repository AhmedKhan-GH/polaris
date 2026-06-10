'use client';

// Stale-chunk recovery after deploys.
//
// When a new build ships, the chunk filenames change (their content hashes move)
// and the old ones are pruned from the CDN. A user still holding the previous
// HTML will request a chunk hash that no longer exists; the dynamic import
// rejects and React surfaces a "ChunkLoadError"/"Loading chunk … failed". The
// fix is simply to reload onto the fresh HTML, which references the live chunks.
//
// The sessionStorage cooldown guards against a reload loop: if the *new* build is
// itself broken — i.e. the chunk error reproduces on the reloaded page — we would
// otherwise reload forever. By recording the last reload timestamp and refusing
// to reload again within the window, a genuinely broken deploy throws once and is
// deliberately left to surface (to the error boundary / the user) rather than
// being masked behind an infinite refresh.

import { useEffect } from 'react';

const CHUNK_PATTERN =
  /ChunkLoadError|Loading chunk [\w/-]+ failed|Failed to load chunk/i;

const COOLDOWN_MS = 10_000;
const COOLDOWN_KEY = 'chunk-reload-at';

export function ChunkErrorReloader() {
  useEffect(() => {
    const maybeReload = (message: string) => {
      if (!CHUNK_PATTERN.test(message)) return;

      const stored = Number(sessionStorage.getItem(COOLDOWN_KEY) ?? 0);
      if (Date.now() - stored <= COOLDOWN_MS) return;

      sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      maybeReload(e.message || String(e.error ?? ''));
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      maybeReload(String((e.reason as Error)?.message ?? e.reason ?? ''));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
