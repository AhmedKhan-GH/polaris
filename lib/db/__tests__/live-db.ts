// Decides whether a live-Supabase integration suite should run, skip, or refuse
// to skip. Pure so it's unit-tested (live-db.test.ts) without a database.
//
// - reachable     → the live DB answered `select 1` in beforeAll.
// - requireLive   → CI declared the live DB MUST be present (CI_REQUIRE_LIVE_DB).
//
// Locally (no `supabase start`) the suite skips and `npm test` stays green. In
// the CI job that DOES start Supabase we set CI_REQUIRE_LIVE_DB so an unreachable
// DB is a hard failure instead of a silent green — these suites hold the only
// coverage of the auth.uid()/`authenticated` RLS path.
export function liveDbGate(reachable: boolean, requireLive: boolean): 'run' | 'skip' {
  if (reachable) return 'run'
  if (requireLive) {
    throw new Error(
      'CI_REQUIRE_LIVE_DB is set but the live Supabase DB is unreachable — ' +
        'refusing to skip live-DB RLS isolation tests (they would silently pass). ' +
        'Ensure `supabase start` ran and DATABASE host :54322 is up.',
    )
  }
  return 'skip'
}
