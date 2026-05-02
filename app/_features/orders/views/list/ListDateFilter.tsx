'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { DateTimeInput } from '@/components/ui/date-time-input'
import { usePreferences } from '../../../preferences/PreferencesProvider'

export type ListDateFilterValues = {
  dateFrom: string
  timeFrom: string
  dateTo: string
  timeTo: string
}

export function ListDateFilter({
  value,
  onChange,
}: {
  value: ListDateFilterValues
  onChange: (next: ListDateFilterValues) => void
}) {
  const { hour12 } = usePreferences()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { dateFrom, timeFrom, dateTo, timeTo } = value
  const active =
    dateFrom !== '' || timeFrom !== '' || dateTo !== '' || timeTo !== ''
  const activeBounds =
    (dateFrom !== '' || timeFrom !== '' ? 1 : 0) +
    (dateTo !== '' || timeTo !== '' ? 1 : 0)

  function patch(next: Partial<ListDateFilterValues>) {
    onChange({ ...value, ...next })
  }

  function clear() {
    onChange({
      dateFrom: '',
      timeFrom: '',
      dateTo: '',
      timeTo: '',
    })
  }

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (
        target instanceof Element &&
        target.closest('[data-date-time-input-calendar]')
      ) {
        return
      }
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      className="relative inline-block self-start [color-scheme:dark]"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
      >
        <span>Created</span>
        {active && (
          <span className="rounded-full bg-blue-500/20 px-1.5 text-[10px] font-medium leading-4 text-blue-300">
            {Math.max(1, activeBounds)}
          </span>
        )}
        {open ? (
          <ChevronUpIcon
            aria-hidden
            className="h-4 w-4 text-zinc-500"
          />
        ) : (
          <ChevronDownIcon
            aria-hidden
            className="h-4 w-4 text-zinc-500"
          />
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Created date range filter"
          className="absolute left-0 top-full z-10 mt-1 w-max max-w-[calc(100vw-2rem)] rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-lg"
        >
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[3rem_auto_auto] items-center gap-2 rounded px-2 py-1">
              <span className="inline-flex h-7 items-center text-xs font-medium uppercase tracking-wider text-zinc-500">
                From
              </span>
              <div className="min-w-0">
                <DateTimeInput
                  value={{ date: dateFrom, time: timeFrom }}
                  onChange={(next) =>
                    patch({ dateFrom: next.date, timeFrom: next.time })
                  }
                  max={dateTo || undefined}
                  hour12={hour12}
                  dateAriaLabel="Created from date"
                  timeAriaLabel="Created from time (defaults to 00:00 when blank)"
                />
              </div>
              <ResetButton
                ariaLabel="Clear from date and time"
                disabled={dateFrom === '' && timeFrom === ''}
                onClick={() => patch({ dateFrom: '', timeFrom: '' })}
              />
            </div>
            <div className="grid grid-cols-[3rem_auto_auto] items-center gap-2 rounded px-2 py-1">
              <span className="inline-flex h-7 items-center text-xs font-medium uppercase tracking-wider text-zinc-500">
                To
              </span>
              <div className="min-w-0">
                <DateTimeInput
                  value={{ date: dateTo, time: timeTo }}
                  onChange={(next) =>
                    patch({ dateTo: next.date, timeTo: next.time })
                  }
                  min={dateFrom || undefined}
                  hour12={hour12}
                  dateAriaLabel="Created to date"
                  timeAriaLabel="Created to time (defaults to 23:59 when blank)"
                />
              </div>
              <ResetButton
                ariaLabel="Clear to date and time"
                disabled={dateTo === '' && timeTo === ''}
                onClick={() => patch({ dateTo: '', timeTo: '' })}
              />
            </div>
          </div>
          <div className="my-1 border-t border-zinc-800" />
          <button
            type="button"
            disabled={!active}
            onClick={clear}
            aria-label="Clear date range filter (show all orders)"
            title={
              active
                ? 'Clear date range filter'
                : 'Date range is unspecified; showing all orders'
            }
            className="w-full rounded px-2 py-1 text-left text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}

function ResetButton({
  ariaLabel,
  disabled,
  onClick,
}: {
  ariaLabel: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
    >
      <ArrowPathIcon
        aria-hidden
        className="h-3.5 w-3.5"
      />
    </button>
  )
}

// Compute the offset (ms) between the supplied IANA timezone and UTC at
// a given instant. Used to convert a typed wall-clock filter bound into
// the matching epoch millisecond.
function tzOffsetMs(timeZone: string, atMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(atMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const wallAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second'),
  )
  return wallAsUtc - atMs
}

// Combine a date string ('yyyy-mm-dd') and a time string ('HH:MM' or
// 'HH:MM:SS', or '' / malformed -> fallback to start/end of day) into
// epoch milliseconds matching orders.created_at. The wall-clock value
// is interpreted in the supplied IANA timezone so 'From: 09:00' means
// 9am in the user's chosen zone, not in the browser's locale.
export function boundToTimestamp(
  date: string,
  time: string,
  kind: 'start' | 'end',
  timeZone: string,
): number | null {
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dateMatch) return null
  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2]) - 1
  const day = Number(dateMatch[3])

  // Accept either 24h ('14:30:00') or 12h ('2:30:00 PM') input. The
  // optional capture group on the AM/PM marker requires both letters
  // (a partially typed 'P' is not a valid commit) and is case-
  // insensitive. Whitespace between the time and the marker is
  // optional so '2:30PM' parses too.
  const tm = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([apAP][mM])?$/)
  const isEnd = kind === 'end'
  let h: number, mn: number, s: number, msPart: number
  if (tm) {
    h = Number(tm[1])
    mn = Number(tm[2])
    const period = tm[4]?.toLowerCase()
    if (period === 'pm' && h < 12) h += 12
    else if (period === 'am' && h === 12) h = 0
    if (tm[3] !== undefined) {
      s = Number(tm[3])
      msPart = isEnd ? 999 : 0
    } else {
      s = isEnd ? 59 : 0
      msPart = isEnd ? 999 : 0
    }
  } else {
    h = isEnd ? 23 : 0
    mn = isEnd ? 59 : 0
    s = isEnd ? 59 : 0
    msPart = isEnd ? 999 : 0
  }
  // Treat the wall-clock components as if they were UTC, then subtract
  // the actual offset of that wall-clock in the target zone. One pass
  // is correct for every instant except the ~1 hour/year DST fall-back
  // ambiguity, which we accept since filter bounds are end-user input.
  const guess = Date.UTC(year, month, day, h, mn, s, msPart)
  return guess - tzOffsetMs(timeZone, guess)
}
