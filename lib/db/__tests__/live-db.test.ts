import { describe, expect, it } from 'vitest'
import { liveDbGate } from './live-db'

// The live-DB integration suites (profiles, realtime broadcast) self-skip when
// the Supabase DB isn't reachable so a local `npm test` stays green without
// `supabase start`. But that same self-skip meant they passed in NO CI job (the
// build job has no Supabase; the e2e job never ran them) — a policy regression
// would ship green. `liveDbGate` makes the skip a HARD FAILURE when CI declares
// the live DB must be present (CI_REQUIRE_LIVE_DB), so the tests can no longer
// silently pass.
describe('liveDbGate', () => {
  it('runs when the live DB is reachable', () => {
    expect(liveDbGate(true, false)).toBe('run')
    expect(liveDbGate(true, true)).toBe('run')
  })

  it('skips when unreachable and the live DB is not required', () => {
    expect(liveDbGate(false, false)).toBe('skip')
  })

  it('throws when unreachable but the live DB is required (CI)', () => {
    expect(() => liveDbGate(false, true)).toThrow(/CI_REQUIRE_LIVE_DB/)
  })
})
