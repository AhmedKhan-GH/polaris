// @vitest-environment node
//
// liveDbGate unit contract (lib/db/__tests__/live-db). Pure decision function:
// given whether the live Supabase DB is reachable and whether CI demands a live
// run, it returns 'run' or 'skip' — and refuses to silently 'skip' when a live
// run was demanded but the DB is down (such a skip would let RLS isolation tests
// vanish into a false green). No database is touched here; the reachability
// probe itself is exercised against a real Postgres in the integration suite.

import { describe, expect, it } from 'vitest';

import { liveDbGate } from './live-db';

describe('liveDbGate', () => {
  it("returns 'run' when the DB is reachable, regardless of requireLive", () => {
    expect(liveDbGate(true, false)).toBe('run');
    expect(liveDbGate(true, true)).toBe('run');
  });

  it("returns 'skip' when unreachable and a live run is not required", () => {
    expect(liveDbGate(false, false)).toBe('skip');
  });

  it('throws when unreachable but a live run is required', () => {
    expect(() => liveDbGate(false, true)).toThrow(/CI_REQUIRE_LIVE_DB/);
    expect(() => liveDbGate(false, true)).toThrow(/supabase start/);
    expect(() => liveDbGate(false, true)).toThrow(/:54322/);
  });
});
