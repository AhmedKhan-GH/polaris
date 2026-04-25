'use client'

import Link from 'next/link'

export type View = 'kanban' | 'spreadsheet'

const VIEWS: { value: View; label: string }[] = [
  { value: 'kanban', label: 'Kanban' },
  { value: 'spreadsheet', label: 'Spreadsheet' },
]

export function ViewSwitcher({ current }: { current: View }) {
  return (
    <div
      role="tablist"
      aria-label="Orders view"
      className="inline-flex overflow-hidden rounded-md border border-zinc-700 bg-zinc-900"
    >
      {VIEWS.map((view) => {
        const active = view.value === current
        return (
          <Link
            key={view.value}
            href={`?view=${view.value}`}
            replace
            scroll={false}
            role="tab"
            aria-selected={active}
            className={
              active
                ? 'px-3 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-900'
                : 'px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800'
            }
          >
            {view.label}
          </Link>
        )
      })}
    </div>
  )
}
