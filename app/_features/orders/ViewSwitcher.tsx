'use client'

export type View = 'kanban' | 'spreadsheet'

const VIEWS: { value: View; label: string }[] = [
  { value: 'kanban', label: 'Kanban' },
  { value: 'spreadsheet', label: 'Spreadsheet' },
]

export function ViewSwitcher({
  current,
  onChange,
}: {
  current: View
  onChange: (next: View) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Orders view"
      className="inline-flex overflow-hidden rounded-md border border-zinc-700 bg-zinc-900"
    >
      {VIEWS.map((view) => {
        const active = view.value === current
        return (
          <button
            key={view.value}
            type="button"
            onClick={() => onChange(view.value)}
            role="tab"
            aria-selected={active}
            className={
              active
                ? 'px-3 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-900'
                : 'px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800'
            }
          >
            {view.label}
          </button>
        )
      })}
    </div>
  )
}
