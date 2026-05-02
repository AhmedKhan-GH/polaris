'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

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
  datePlaceholder?: string
  timePlaceholder?: string
}

function DateTimeInput({
  value,
  onChange,
  dateAriaLabel,
  timeAriaLabel,
  min,
  max,
  className,
  datePlaceholder = 'YYYY-MM-DD',
  timePlaceholder = 'HH:MM:SS',
}: DateTimeInputProps) {
  const [open, setOpen] = React.useState(false)
  const emptyDate = value.date === ''
  const selected = isoToLocalDate(value.date)
  const minDate = isoToLocalDate(min)
  const maxDate = isoToLocalDate(max)

  function patch(next: Partial<DateTimeInputValue>) {
    onChange({ ...value, ...next })
  }

  return (
    <div className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={dateAriaLabel}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded px-1 font-mono text-sm hover:bg-zinc-800/50 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
          >
            <span
              className={cn(
                'inline-flex h-full shrink-0 items-center whitespace-nowrap',
                emptyDate ? 'text-zinc-400' : 'text-zinc-100',
              )}
            >
              {emptyDate ? datePlaceholder : value.date}
            </span>
            <CalendarIcon
              aria-hidden
              className="h-3 w-3 shrink-0 text-zinc-400"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          data-date-time-input-calendar
          className="w-auto p-0"
          align="start"
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minDate ?? maxDate ?? new Date()}
            onSelect={(d) => {
              if (d) patch({ date: localDateToIso(d) })
              setOpen(false)
            }}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
          />
        </PopoverContent>
      </Popover>
      <label className="inline-flex h-7 shrink-0 cursor-text items-center rounded hover:bg-zinc-800/50 focus-within:ring-1 focus-within:ring-blue-400/40">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{1,2}:\d{2}(:\d{2})?"
          value={value.time}
          onChange={(e) => {
            const next = e.target.value
            if (next === '' || PARTIAL_TIME.test(next)) patch({ time: next })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          placeholder={timePlaceholder}
          aria-label={timeAriaLabel}
          autoComplete="off"
          className="block w-[75px] shrink-0 appearance-none border-0 bg-transparent px-1 py-0 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-400"
        />
      </label>
    </div>
  )
}
DateTimeInput.displayName = 'DateTimeInput'

const PARTIAL_TIME = /^\d{0,2}(:\d{0,2}(:\d{0,2})?)?$/

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

export { DateTimeInput }
