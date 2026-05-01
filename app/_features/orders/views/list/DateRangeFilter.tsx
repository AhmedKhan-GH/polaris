'use client'

import { useState } from 'react'
import { CalendarIcon, RotateCcw } from 'lucide-react'
import { Calendar as ShadCalendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type DateRangeFilterValues = {
  dateFrom: string
  timeFrom: string
  dateTo: string
  timeTo: string
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeFilterValues
  onChange: (next: DateRangeFilterValues) => void
}) {
  const { dateFrom, timeFrom, dateTo, timeTo } = value
  const active =
    dateFrom !== '' || timeFrom !== '' || dateTo !== '' || timeTo !== ''

  function patch(next: Partial<DateRangeFilterValues>) {
    onChange({ ...value, ...next })
  }

  return (
    <div className="flex h-9 flex-wrap items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 py-0 pl-3 pr-1 [color-scheme:dark]">
      <span className="inline-flex h-7 items-center text-xs font-medium uppercase leading-none tracking-wider text-zinc-500">
        From
      </span>
      <DateField
        value={dateFrom}
        onChange={(next) => patch({ dateFrom: next })}
        max={dateTo || undefined}
        ariaLabel="Created from date"
      />
      <TimeField
        value={timeFrom}
        onChange={(next) => patch({ timeFrom: next })}
        ariaLabel="Created from time (defaults to 00:00 when blank)"
      />
      <span
        aria-hidden
        className="inline-flex h-7 items-center leading-none text-zinc-500"
      >
        →
      </span>
      <span className="inline-flex h-7 items-center text-xs font-medium uppercase leading-none tracking-wider text-zinc-500">
        To
      </span>
      <DateField
        value={dateTo}
        onChange={(next) => patch({ dateTo: next })}
        min={dateFrom || undefined}
        ariaLabel="Created to date"
      />
      <TimeField
        value={timeTo}
        onChange={(next) => patch({ timeTo: next })}
        ariaLabel="Created to time (defaults to 23:59 when blank)"
      />
      <button
        type="button"
        disabled={!active}
        onClick={() =>
          onChange({
            dateFrom: '',
            timeFrom: '',
            dateTo: '',
            timeTo: '',
          })
        }
        aria-label="Clear date range filter (show all orders)"
        title={
          active
            ? 'Clear date range filter'
            : 'Date range is unspecified — showing all orders'
        }
        className="inline-flex h-7 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 text-xs font-medium leading-none text-zinc-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-200"
      >
        <RotateCcw aria-hidden className="h-3.5 w-3.5" />
        <span>Clear</span>
      </button>
    </div>
  )
}

// Combine a date string ('yyyy-mm-dd') and a time string ('HH:MM' or
// 'HH:MM:SS', or '' / malformed -> fallback to start/end of day) into
// the timestamp shape Postgres stores in orders.created_at.
export function boundToTimestamp(
  date: string,
  time: string,
  kind: 'start' | 'end',
): string | null {
  if (!date) return null
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  let suffix: string
  if (match) {
    const h = match[1].padStart(2, '0')
    const m = match[2]
    const s = match[3]
    if (s !== undefined) {
      suffix = kind === 'end' ? `${h}:${m}:${s}.999` : `${h}:${m}:${s}.000`
    } else {
      suffix = kind === 'end' ? `${h}:${m}:59.999` : `${h}:${m}:00.000`
    }
  } else {
    suffix = kind === 'end' ? '23:59:59.999' : '00:00:00.000'
  }
  return `${date} ${suffix}`
}

function DateField({
  value,
  onChange,
  ariaLabel,
  min,
  max,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
  min?: string
  max?: string
}) {
  const [open, setOpen] = useState(false)
  const empty = value === ''
  const selected = isoToLocalDate(value)
  const minDate = isoToLocalDate(min)
  const maxDate = isoToLocalDate(max)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-7 items-center gap-1.5 rounded px-1 font-mono text-sm hover:bg-zinc-800/50 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
        >
          <span className={empty ? 'text-zinc-600' : 'text-zinc-200'}>
            {empty ? 'YYYY-MM-DD' : value}
          </span>
          <CalendarIcon aria-hidden className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <ShadCalendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate ?? maxDate ?? new Date()}
          onSelect={(d) => {
            if (d) onChange(localDateToIso(d))
            setOpen(false)
          }}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
        />
      </PopoverContent>
    </Popover>
  )
}

function TimeField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="\d{1,2}:\d{2}(:\d{2})?"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      placeholder="HH:MM:SS"
      aria-label={ariaLabel}
      autoComplete="off"
      className="h-7 w-[75px] rounded bg-transparent px-1 py-0 font-mono text-sm leading-7 text-zinc-200 outline-none placeholder:text-zinc-600 hover:bg-zinc-800/50 focus:ring-1 focus:ring-blue-400/40"
    />
  )
}

function isoToLocalDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return undefined
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function localDateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
