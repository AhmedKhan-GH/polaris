'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'

import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

// shadcn/ui-style Calendar adapted for the project's zinc dark theme.
// Wraps react-day-picker v9 with consistent classNames and a custom
// Chevron component that uses lucide icons. Out-of-the-box look mirrors
// shadcn's reference design without requiring the full CSS-variable
// theming system.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaults = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: cn('w-fit text-zinc-100', defaults.root),
        months: cn('relative flex flex-col gap-4 sm:flex-row', defaults.months),
        month: cn('flex w-full flex-col gap-4', defaults.month),
        month_caption: cn(
          'flex h-9 w-full items-center justify-center px-9',
          defaults.month_caption,
        ),
        caption_label: cn(
          'select-none text-sm font-medium text-zinc-100',
          defaults.caption_label,
        ),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between',
          defaults.nav,
        ),
        button_previous: cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40',
          defaults.button_previous,
        ),
        button_next: cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40',
          defaults.button_next,
        ),
        chevron: cn('h-4 w-4', defaults.chevron),
        month_grid: cn('w-full border-collapse', defaults.month_grid),
        weekdays: cn('flex', defaults.weekdays),
        weekday: cn(
          'flex h-8 w-9 items-center justify-center text-[0.75rem] font-normal text-zinc-400',
          defaults.weekday,
        ),
        week: cn('mt-1 flex w-full', defaults.week),
        day: cn(
          'relative flex h-9 w-9 items-center justify-center p-0 text-center text-sm focus-within:relative focus-within:z-20',
          defaults.day,
        ),
        day_button: cn(
          'inline-flex h-8 w-8 select-none items-center justify-center rounded-md font-normal text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70',
          defaults.day_button,
        ),
        selected: cn(
          '[&_button]:!bg-blue-500 [&_button]:!text-white [&_button]:hover:!bg-blue-400',
          defaults.selected,
        ),
        today: cn(
          '[&:not(.rdp-selected)_button]:bg-zinc-800 [&:not(.rdp-selected)_button]:text-zinc-100',
          defaults.today,
        ),
        outside: cn(
          '[&_button]:text-zinc-400 aria-selected:[&_button]:text-zinc-400',
          defaults.outside,
        ),
        disabled: cn('[&_button]:text-zinc-400', defaults.disabled),
        hidden: cn('invisible', defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" {...rest} />
          ) : (
            <ChevronRight className="h-4 w-4" {...rest} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
