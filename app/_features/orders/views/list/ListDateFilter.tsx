'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowPathIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
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
        target.closest('[data-date-filter-calendar]')
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
          className="absolute left-0 top-full z-10 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-lg"
        >
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 rounded px-2 py-1">
              <span className="inline-flex h-7 items-center text-xs font-medium uppercase tracking-wider text-zinc-500">
                From
              </span>
              <div className="flex min-w-0 items-center gap-2">
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
              </div>
              <ResetButton
                ariaLabel="Clear from date and time"
                disabled={dateFrom === '' && timeFrom === ''}
                onClick={() => patch({ dateFrom: '', timeFrom: '' })}
              />
            </div>
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 rounded px-2 py-1">
              <span className="inline-flex h-7 items-center text-xs font-medium uppercase tracking-wider text-zinc-500">
                To
              </span>
              <div className="flex min-w-0 items-center gap-2">
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
          className="flex h-7 shrink-0 items-center gap-1.5 rounded px-1 font-mono text-sm hover:bg-zinc-800/50 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
        >
          <span
            className={`inline-flex h-full shrink-0 items-center whitespace-nowrap ${empty ? 'text-zinc-600' : 'text-zinc-200'}`}
          >
            {empty ? 'YYYY-MM-DD' : value}
          </span>
          <CalendarIcon
            aria-hidden
            className="h-3 w-3 shrink-0 text-zinc-500"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-date-filter-calendar
        className="w-auto p-0"
        align="start"
      >
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
    <label className="inline-flex h-7 shrink-0 cursor-text items-center rounded hover:bg-zinc-800/50 focus-within:ring-1 focus-within:ring-blue-400/40">
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
        className="block w-[75px] shrink-0 appearance-none border-0 bg-transparent px-1 py-0 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
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
