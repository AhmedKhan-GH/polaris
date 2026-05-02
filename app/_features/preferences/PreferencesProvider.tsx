'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const TIMEZONE_KEY = 'polaris.timezone'
const HOUR12_KEY = 'polaris.hour12'

type Preferences = {
  timezone: string
  setTimezone: (tz: string) => void
  hour12: boolean
  setHour12: (next: boolean) => void
}

const PreferencesContext = createContext<Preferences | null>(null)

// SSR can't know the browser's IANA zone, so the first paint uses UTC
// + 24h as deterministic placeholders. The provider hydrates the real
// preferences (localStorage if set, else the browser's resolved zone)
// in an effect so user-visible timestamps don't flicker into place
// from a server-rendered shell.
function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>('UTC')
  const [hour12, setHour12State] = useState<boolean>(false)

  useEffect(() => {
    setTimezoneState(localStorage.getItem(TIMEZONE_KEY) ?? browserTimezone())
    setHour12State(localStorage.getItem(HOUR12_KEY) === 'true')
  }, [])

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz)
    try {
      localStorage.setItem(TIMEZONE_KEY, tz)
    } catch {
      // localStorage can throw in private browsing on some platforms;
      // the in-memory choice still applies for the session.
    }
  }, [])

  const setHour12 = useCallback((next: boolean) => {
    setHour12State(next)
    try {
      localStorage.setItem(HOUR12_KEY, String(next))
    } catch {
      // see above
    }
  }, [])

  const value = useMemo<Preferences>(
    () => ({ timezone, setTimezone, hour12, setHour12 }),
    [timezone, setTimezone, hour12, setHour12],
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): Preferences {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error('usePreferences must be used inside PreferencesProvider')
  }
  return ctx
}
