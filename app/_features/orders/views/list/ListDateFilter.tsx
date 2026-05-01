'use client'

import { useState } from 'react'
import { ArrowRight, CalendarIcon } from 'lucide-react'
import { Calendar as ShadCalendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

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
  const { dateFrom, timeFrom, dateTo, timeTo } = value
  const active =
    dateFrom !== '' || timeFrom !== '' || dateTo !== '' || timeTo !== ''

  function patch(next: Partial<ListDateFilterValues>) {
    onChange({ ...value, ...next })
  }

  return (
    <div className="inline-flex h-9 items-stretch overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 [color-scheme:dark]">
      <div className="flex h-full items-center gap-2 px-3">
        <span className="inline-flex h-7 items-center text-xs font-medium uppercase tracking-wider text-zinc-500">
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
          className="inline-flex h-7 items-center justify-center text-zinc-500"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
        <span className="inline-flex h-7 items-center text-xs font-medium uppercase tracking-wider text-zinc-500">
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
      </div>
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
        className="inline-flex h-full items-center border-l border-zinc-700 bg-zinc-800/70 px-3 text-xs font-medium leading-none text-zinc-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:bg-zinc-800/70 disabled:hover:text-zinc-200"
      >
        Clear filters
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
          <span
            className={`inline-flex h-full items-center ${empty ? 'text-zinc-600' : 'text-zinc-200'}`}
          >
            {empty ? 'YYYY-MM-DD' : value}
          </span>
          <CalendarIcon aria-hidden className="h-3 w-3 text-zinc-500" />
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
    <label className="inline-flex h-7 cursor-text items-center rounded hover:bg-zinc-800/50 focus-within:ring-1 focus-within:ring-blue-400/40">
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
        className="block w-[75px] appearance-none border-0 bg-transparent px-1 py-0 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
      />
    </label>
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
