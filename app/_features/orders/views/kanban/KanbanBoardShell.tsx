import { Fragment, type ReactNode } from 'react'

// Transition labels sit between columns as board-level demarcators (the
// arrow points into the next column). Index N = label above column N.
// The last column (Archiving) has no outbound transition, so it gets an
// invisible spacer to keep all four sections top-aligned.
const TRANSITION_LABELS = [
  'Submit →',
  'Invoice →',
  'Close →',
  undefined,
] as const

interface KanbanBoardShellProps {
  columns: ReactNode[]
}

export function KanbanBoardShell({ columns }: KanbanBoardShellProps) {
  return (
    <div className="flex-1 min-h-0 flex overflow-x-auto scrollbar-thin">
      <div className="flex flex-1 min-h-0 items-stretch">
        {columns.map((col, i) => {
          const label = TRANSITION_LABELS[i]
          return (
            <Fragment key={i}>
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                {label ? (
                  <span className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                    {label}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-transparent whitespace-nowrap select-none"
                  >
                    &nbsp;
                  </span>
                )}
                {col}
              </div>
              {i < columns.length - 1 && (
                <div
                  aria-hidden
                  className="mx-4 w-0.5 shrink-0 self-stretch rounded-full bg-zinc-700"
                />
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
