/**
 * No-op teardown. The E2E suite runs against the long-lived local Supabase stack
 * (started out of band via `supabase start`), so there is nothing for the run to
 * stop or dispose here — the next run's global-setup re-migrates and re-seeds
 * idempotently. Kept as an explicit file so the Playwright config's
 * `globalTeardown` hook always resolves.
 */
export default async function globalTeardown(): Promise<void> {
  // Intentionally empty: live local stack; nothing to stop.
}
