import pg from 'pg';

/**
 * Connection string for the local Supabase Postgres (`supabase start`). Live-DB
 * RLS isolation suites connect here as the superuser to seed, then simulate the
 * `authenticated` path inside rolled-back transactions. This is the real stack —
 * the only place the Supabase `auth` schema (and thus `auth.uid()` in policies)
 * exists, which is exactly what those suites need to exercise.
 */
export const LIVE_DB =
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * Probes whether {@link LIVE_DB} is up, fail-closed: any error (DB down, auth,
 * timeout) resolves to `false` rather than throwing. The short
 * `connectionTimeoutMillis` keeps a missing stack from stalling the suite.
 */
export async function isLiveDbReachable(): Promise<boolean> {
  const client = new pg.Client({
    connectionString: LIVE_DB,
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    await client.query('select 1');
    return true;
  } catch {
    return false;
  } finally {
    // end() can itself reject if connect() never succeeded; swallow it so the
    // probe's verdict is decided solely by the connect/query above.
    await client.end().catch(() => {});
  }
}

/**
 * Decides whether a live-DB suite should `run` or `skip`. The one rule that
 * earns this its own unit: when a live run is demanded (`CI_REQUIRE_LIVE_DB`)
 * but the DB is unreachable, it THROWS instead of skipping — a silent skip there
 * would let the RLS isolation tests pass without ever running, hiding a
 * regression. Reachable always runs; unreachable-and-optional skips.
 */
export function liveDbGate(
  reachable: boolean,
  requireLive: boolean,
): 'run' | 'skip' {
  if (reachable) return 'run';
  if (requireLive) {
    throw new Error(
      'CI_REQUIRE_LIVE_DB is set but the live Supabase DB is unreachable — ' +
        'refusing to skip live-DB RLS isolation tests (they would silently ' +
        'pass). Ensure `supabase start` ran and the DB at :54322 is up.',
    );
  }
  return 'skip';
}
