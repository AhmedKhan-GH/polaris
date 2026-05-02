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
  // When true, render an AM/PM segment after seconds and prompt for
  // 12h-shaped values. The 24h variant is the default.
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
  datePlaceholder = 'YYYY-MM-DD',
  hour12 = false,
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
      <SegmentedTimeInput
        value={value.time}
        onChange={(next) => patch({ time: next })}
        ariaLabel={timeAriaLabel}
        hour12={hour12}
      />
    </div>
  )
}
DateTimeInput.displayName = 'DateTimeInput'

// Segmented time input. Each unit (HH, MM, SS, optional AM/PM) is its
// own focusable child input with placeholder digits and click-to-edit
// behavior, mirroring shadcn's date-picker segments and the native
// <input type="time"> field model. The component still emits a single
// canonical time string so downstream parsers (boundToTimestamp) keep
// working unchanged.
type Segments = {
  hh: string
  mm: string
  ss: string
  period: string // 'AM' | 'PM' | ''
}

type SegmentKey = keyof Segments

function SegmentedTimeInput({
  value,
  onChange,
  ariaLabel,
  hour12,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
  hour12: boolean
}) {
  const segments = parseTimeToSegments(value)
  const refs: Record<SegmentKey, React.RefObject<HTMLInputElement | null>> = {
    hh: React.useRef<HTMLInputElement | null>(null),
    mm: React.useRef<HTMLInputElement | null>(null),
    ss: React.useRef<HTMLInputElement | null>(null),
    period: React.useRef<HTMLInputElement | null>(null),
  }

  const order: SegmentKey[] = hour12
    ? ['hh', 'mm', 'ss', 'period']
    : ['hh', 'mm', 'ss']

  function emit(next: Segments) {
    onChange(formatSegmentsToTime(next, hour12))
  }

  function focusSegment(key: SegmentKey) {
    const el = refs[key].current
    if (!el) return
    el.focus()
    // Defer select() so it survives focus's own caret-positioning.
    requestAnimationFrame(() => el.select())
  }

  function focusSibling(from: SegmentKey, dir: 1 | -1) {
    const idx = order.indexOf(from)
    const target = order[idx + dir]
    if (target) focusSegment(target)
  }

  function commitDigits(key: 'hh' | 'mm' | 'ss', raw: string) {
    // Keep at most 2 digits.
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    emit({ ...segments, [key]: digits })
    if (digits.length === 2) focusSibling(key, 1)
  }

  function commitPeriod(raw: string) {
    // Accept the first letter typed; toggle to AM if 'a', PM if 'p'.
    // A two-letter input like 'AM' or 'PM' resolves the same way.
    const first = raw.trim().toUpperCase().charAt(0)
    let period: string
    if (first === 'A') period = 'AM'
    else if (first === 'P') period = 'PM'
    else period = ''
    emit({ ...segments, period })
    // Period is the last segment; no auto-advance.
  }

  function onSegmentKeyDown(
    key: SegmentKey,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    const input = e.currentTarget
    const caret = input.selectionStart ?? 0
    const len = input.value.length

    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault()
      input.blur()
      return
    }
    if (e.key === 'ArrowLeft' && caret === 0) {
      e.preventDefault()
      focusSibling(key, -1)
      return
    }
    if (e.key === 'ArrowRight' && caret === len) {
      e.preventDefault()
      focusSibling(key, 1)
      return
    }
    if (e.key === 'Backspace' && len === 0) {
      e.preventDefault()
      focusSibling(key, -1)
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Period segment cycles AM<->PM; numeric segments leave default.
      if (key === 'period') {
        e.preventDefault()
        emit({
          ...segments,
          period: segments.period === 'PM' ? 'AM' : 'PM',
        })
      }
      return
    }
    if (e.key === ':' || e.key === ' ') {
      // Treat colon and space as "advance to next segment" so muscle
      // memory from a single-input still works.
      e.preventDefault()
      focusSibling(key, 1)
      return
    }
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex h-7 shrink-0 items-center gap-0 rounded px-1 font-mono text-sm text-zinc-100 hover:bg-zinc-800/50 focus-within:ring-1 focus-within:ring-blue-400/40"
    >
      <Segment
        ref={refs.hh}
        value={segments.hh}
        onChange={(next) => commitDigits('hh', next)}
        onKeyDown={(e) => onSegmentKeyDown('hh', e)}
        placeholder="HH"
        ariaLabel="Hours"
        width="ch-2"
        inputMode="numeric"
      />
      <Sep>:</Sep>
      <Segment
        ref={refs.mm}
        value={segments.mm}
        onChange={(next) => commitDigits('mm', next)}
        onKeyDown={(e) => onSegmentKeyDown('mm', e)}
        placeholder="MM"
        ariaLabel="Minutes"
        width="ch-2"
        inputMode="numeric"
      />
      <Sep>:</Sep>
      <Segment
        ref={refs.ss}
        value={segments.ss}
        onChange={(next) => commitDigits('ss', next)}
        onKeyDown={(e) => onSegmentKeyDown('ss', e)}
        placeholder="SS"
        ariaLabel="Seconds"
        width="ch-2"
        inputMode="numeric"
      />
      {hour12 && (
        <>
          <Sep>&nbsp;</Sep>
          <Segment
            ref={refs.period}
            value={segments.period}
            onChange={commitPeriod}
            onKeyDown={(e) => onSegmentKeyDown('period', e)}
            placeholder="--"
            ariaLabel="AM or PM"
            width="ch-2"
            inputMode="text"
            uppercase
          />
        </>
      )}
    </div>
  )
}

const Segment = React.forwardRef<
  HTMLInputElement,
  {
    value: string
    onChange: (next: string) => void
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
    placeholder: string
    ariaLabel: string
    width: 'ch-2'
    inputMode: 'numeric' | 'text'
    uppercase?: boolean
  }
>(function Segment(
  { value, onChange, onKeyDown, placeholder, ariaLabel, inputMode, uppercase },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={(e) => e.currentTarget.select()}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoComplete="off"
      maxLength={2}
      className={cn(
        'w-[2ch] shrink-0 appearance-none border-0 bg-transparent p-0 text-center font-mono text-sm text-zinc-100 caret-transparent outline-none placeholder:text-zinc-400 focus:caret-current',
        uppercase && 'uppercase',
      )}
    />
  )
})

function Sep({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="select-none text-zinc-400">
      {children}
    </span>
  )
}

// Parse the canonical 'HH:MM:SS' or 'HH:MM:SS PM' string back into
// segments. Permissive: any segment that doesn't match leaves its
// slot empty rather than throwing, so partially-filled values
// roundtrip through the input without losing focus on rerender.
function parseTimeToSegments(time: string): Segments {
  if (!time) return { hh: '', mm: '', ss: '', period: '' }
  const m = time.match(
    /^(\d{0,2})(?::(\d{0,2})(?::(\d{0,2}))?)?\s*([apAP][mM]?)?$/,
  )
  if (!m) return { hh: '', mm: '', ss: '', period: '' }
  const period = m[4]
    ? m[4].length === 2
      ? m[4].toUpperCase()
      : '' // a single 'P' or 'A' isn't a finished period
    : ''
  return {
    hh: m[1] ?? '',
    mm: m[2] ?? '',
    ss: m[3] ?? '',
    period,
  }
}

function formatSegmentsToTime(s: Segments, hour12: boolean): string {
  const allEmpty = !s.hh && !s.mm && !s.ss && !(hour12 && s.period)
  if (allEmpty) return ''
  // Trim trailing empty time parts so '14::' doesn't ship; keep
  // leading parts even when empty so an isolated MM still emits
  // ':30' (boundToTimestamp will treat the missing HH as malformed
  // and fall back, matching pre-segmentation behavior).
  const parts = [s.hh, s.mm, s.ss]
  while (parts.length > 1 && !parts[parts.length - 1]) parts.pop()
  let core = parts.join(':')
  if (hour12 && s.period) {
    core = core ? `${core} ${s.period}` : s.period
  }
  return core
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

export { DateTimeInput }
