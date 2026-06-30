'use client';

import { useRouter } from 'next/navigation';

/**
 * A minimal "go back where you came from" control for the dashboard chrome — a
 * client island because it drives the browser history (`router.back()`). Mirrors
 * the login page's `← Back` affordance, but history-based rather than a fixed
 * link, so it returns to wherever the user actually navigated from.
 *
 * On a DIRECT load (no in-app history — e.g. a pasted URL, `history.length <= 1`)
 * there is nowhere to go back to, so it falls back to `/dashboard` rather than
 * doing nothing or leaving the app.
 */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        window.history.length > 1 ? router.back() : router.push('/dashboard')
      }
      className="text-sm text-ink-muted hover:text-ink hover:underline"
    >
      ← Back
    </button>
  );
}
