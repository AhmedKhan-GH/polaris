'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePreferences } from './PreferencesProvider'

// Intl.supportedValuesOf is widely supported in modern browsers; the
// catch-block keeps SSR and ancient runtimes from crashing — they
// fall back to the user's resolved zone plus a tiny anchor list so
// the dropdown is never empty.
function listTimezones(): string[] {
  try {
    return (
      Intl.supportedValuesOf as ((kind: 'timeZone') => string[]) | undefined
    )?.('timeZone') ?? FALLBACK_TIMEZONES
  } catch {
    return FALLBACK_TIMEZONES
  }
}

const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
]

export function TimezoneSelector() {
  const { timezone, setTimezone } = usePreferences()
  // Node and the browser disagree on whether 'UTC' lives in
  // Intl.supportedValuesOf('timeZone'), so SSR and CSR produce
  // different option lists. Render the populated dropdown only after
  // mount; the placeholder keeps the auth-bar layout stable in the
  // pre-hydration paint.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const zones = useMemo(() => (mounted ? listTimezones() : []), [mounted])

  return (
    <label className="flex items-center gap-1.5 text-sm text-zinc-400">
      <span className="sr-only">Display timezone</span>
      <select
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        aria-label="Display timezone"
        disabled={!mounted}
        className="max-w-[14rem] truncate rounded border border-transparent bg-transparent py-0.5 pl-1 pr-5 text-sm text-zinc-300 hover:text-zinc-100 focus:border-zinc-700 focus:outline-none disabled:opacity-60"
      >
        {/* Defensive: include the current value even if it's not in
            the dropdown list (e.g. a stale localStorage entry from a
            zone the runtime no longer recognizes). */}
        {!zones.includes(timezone) && (
          <option value={timezone}>{timezone}</option>
        )}
        {zones.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
    </label>
  )
}
