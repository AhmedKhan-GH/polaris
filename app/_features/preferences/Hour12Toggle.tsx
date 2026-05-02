'use client'

import { usePreferences } from './PreferencesProvider'

// Compact two-button segmented switch for the auth bar. Pressed state is
// expressed via aria-pressed + a tonal background swap so screen readers
// announce the active mode and sighted users see the same selection
// without a separate label.
export function Hour12Toggle() {
  const { hour12, setHour12 } = usePreferences()
  return (
    <div
      role="group"
      aria-label="Time format"
      className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs"
    >
      <Option active={!hour12} onClick={() => setHour12(false)} label="24h" />
      <Option active={hour12} onClick={() => setHour12(true)} label="12h" />
    </div>
  )
}

function Option({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded px-2 py-0.5 font-medium bg-zinc-700 text-zinc-50'
          : 'rounded px-2 py-0.5 font-medium text-zinc-400 hover:text-zinc-200'
      }
    >
      {label}
    </button>
  )
}
