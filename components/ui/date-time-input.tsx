'use client'

import * as React from 'react'
import {
  DateField,
  DateInput,
  DateSegment,
  I18nProvider,
  TimeField,
  type DateValue,
  type TimeValue,
} from 'react-aria-components'
import {
  CalendarDate,
  Time,
  parseDate,
} from '@internationalized/date'

import { cn } from '@/lib/utils'

// Segmented date and time input pair built on react-aria-components,
// matching the shadcn DateField pattern. Each <DateSegment> is its
// own focusable editable region (year, month, day; hour, minute,
// second; AM/PM in 12h mode) with built-in arrow-key nav, auto-
// advance on completion, and locale-aware formatting. The component
// still emits flat strings on the existing { date, time } contract
// so callers (boundToTimestamp, ListView) work unchanged.

export type DateTimeInputValue = {
  date: string
  time: string
}

export type DateTimeInputProps = {
  value: DateTimeInputValue
  onChange: (next: DateTimeInputValue) => void
  dateAriaLabel: string
  timeAriaLabel: string
  min?: string
  max?: string
  className?: string
  hour12?: boolean
}

function DateTimeInput({
  value,
  onChange,
  dateAriaLabel,
  timeAriaLabel,
  min,
  max,
  className,
  hour12 = false,
}: DateTimeInputProps) {
  const dateValue = isoToCalendarDate(value.date)
  const timeValue = stringToTime(value.time)
  const minDate = isoToCalendarDate(min)
  const maxDate = isoToCalendarDate(max)

  function patch(next: Partial<DateTimeInputValue>) {
    onChange({ ...value, ...next })
  }

  return (
    // en-CA renders dates as YYYY-MM-DD with hyphens, matching the
    // ISO 8601 form the rest of the app stores. Pinning the locale
    // here keeps display order and separator stable across users
    // without dragging in a global locale shift; only this component
    // tree sees it. The TimeField's hour cycle is still controlled
    // explicitly via the hour12 prop, independent of locale.
    <I18nProvider locale="en-CA">
      <div className={cn('inline-flex min-w-0 items-center gap-2', className)}>
        <DateField
          aria-label={dateAriaLabel}
          value={dateValue ?? null}
          onChange={(d) =>
            patch({ date: d ? calendarDateToIso(d as CalendarDate) : '' })
          }
          minValue={minDate ?? undefined}
          maxValue={maxDate ?? undefined}
          granularity="day"
        >
          <DateInput className={cn(fieldClass, 'w-[11ch] justify-center')}>
            {(segment) => (
              <DateSegment
                segment={segment}
                className={segmentClass}
              />
            )}
          </DateInput>
        </DateField>
        <TimeField
          aria-label={timeAriaLabel}
          value={timeValue ?? null}
          onChange={(t) => patch({ time: t ? timeToString(t as Time) : '' })}
          granularity="second"
          hourCycle={hour12 ? 12 : 24}
        >
          <DateInput
            className={cn(
              fieldClass,
              'justify-end',
              hour12 ? 'w-[13ch]' : 'w-[9ch]',
            )}
          >
            {(segment) => (
              <DateSegment
                segment={segment}
                className={segmentClass}
              />
            )}
          </DateInput>
        </TimeField>
      </div>
    </I18nProvider>
  )
}
DateTimeInput.displayName = 'DateTimeInput'

// shadcn-style: the <DateInput> wrapper is the visible "field" --- a
// single rounded container that hovers/focuses as one unit even
// though each segment is its own caret target.
const fieldClass =
  'inline-flex h-7 shrink-0 items-center rounded px-1 font-mono text-sm text-zinc-100 hover:bg-zinc-800/50 focus-within:ring-1 focus-within:ring-blue-400/40'

// Each <DateSegment> styles its own focus and placeholder state via
// react-aria's data attributes. caret-transparent hides the caret on
// segments that aren't editable (literal separators like ':' and
// '/'); placeholder segments get a dimmer color so the field reads
// 'YYYY-MM-DD' / 'HH:MM:SS' before the user starts typing.
const segmentClass =
  'inline-block rounded tabular-nums caret-transparent outline-none data-[type=literal]:text-zinc-400 data-[type=dayPeriod]:ml-1 data-[placeholder]:uppercase data-[placeholder]:text-zinc-400 data-[focused]:bg-blue-500/20 data-[focused]:text-zinc-50 data-[invalid]:text-red-400'

// --- Conversions between the public string contract and react-aria's
// typed values. parseDate throws on malformed input; we silently
// return null so a partially typed or empty filter doesn't crash.

function isoToCalendarDate(iso: string | undefined): CalendarDate | null {
  if (!iso) return null
  try {
    return parseDate(iso)
  } catch {
    return null
  }
}

function calendarDateToIso(d: CalendarDate): string {
  return d.toString() // CalendarDate.toString() emits 'YYYY-MM-DD'
}

// Time strings the rest of the app uses are 24h "HH:MM:SS" or 12h
// "H:MM:SS PM" / "H:MM PM". Output from this component is always 24h
// "HH:MM:SS" because TimeValue is hour-cycle-agnostic and the 12h
// flag only affects how segments render. boundToTimestamp's optional
// AM/PM regex still parses the 24h output correctly.
function stringToTime(time: string | undefined): Time | null {
  if (!time) return null
  const m = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([apAP][mM])?$/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const s = m[3] !== undefined ? Number(m[3]) : 0
  const period = m[4]?.toLowerCase()
  if (period === 'pm' && h < 12) h += 12
  else if (period === 'am' && h === 12) h = 0
  if (h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 59) return null
  return new Time(h, min, s)
}

function timeToString(t: Time): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(t.hour)}:${pad(t.minute)}:${pad(t.second)}`
}

// Re-exported for tests / non-DOM callers that still need the
// underlying TimeValue / DateValue types.
export type { DateValue, TimeValue }

export { DateTimeInput }
