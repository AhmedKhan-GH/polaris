'use client'

export type View = 'detail' | 'board' | 'table'

const VIEW_LABELS: Record<View, string> = {
  detail: 'Detail',
  board: 'Board',
  table: 'Table',
}

export function ViewSwitcher({
  current,
  onChange,
}: {
  current: View
  onChange: (view: View) => void
}) {
  return (
    <div className="flex rounded-md border border-zinc-700 bg-zinc-900">
      {(['detail', 'board', 'table'] as const).map((view) => (
        <button
          key={view}
          type="button"
          onClick={() => onChange(view)}
          className={`px-3 py-1 text-xs font-medium transition-colors first:rounded-l-[5px] last:rounded-r-[5px] ${
            current === view
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {VIEW_LABELS[view]}
        </button>
      ))}
    </div>
  )
}
